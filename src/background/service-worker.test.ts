import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeMock, deleteFollowLensDatabase, dispatch } from '../test/chrome-mock'
import type { SocialUser } from '../platforms/types'

function user(username: string): SocialUser {
  return { id: username, username, displayName: username, avatarUrl: '', isVerified: false, isPrivate: false }
}

beforeEach(async () => {
  vi.resetModules()
  await deleteFollowLensDatabase()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('service worker: concurrent multi-platform reporting', () => {
  it('keeps both platforms\' buffered data when their pages report at the same time', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    // Two tabs (Instagram + X) posting FRIENDSHIP_PAGE around the same time,
    // neither awaited before the other starts — this is what used to race.
    const instagramReport = dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('insta-follower')],
    })
    const xReport = dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'github',
      accountId: 'acc-b',
      direction: 'followers',
      users: [user('x-follower')],
    })
    await Promise.all([instagramReport, xReport])

    const instagramStatus = await dispatch(listener, { type: 'GET_BUFFER_STATUS', platform: 'instagram', accountId: 'acc-a' })
    const githubStatus = await dispatch(listener, { type: 'GET_BUFFER_STATUS', platform: 'github', accountId: 'acc-b' })

    expect(instagramStatus.value.followers).toBe(1)
    expect(githubStatus.value.followers).toBe(1)
  })

  it('does not drop a second account\'s data reported while the first account is mid-write', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    // Same platform, two different accounts (e.g. two tabs logged into
    // different Instagram accounts) — same shared-buffer hazard.
    const first = dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1'), user('u2')],
    })
    const second = dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-c',
      direction: 'followers',
      users: [user('u3')],
    })
    await Promise.all([first, second])

    const statusA = await dispatch(listener, { type: 'GET_BUFFER_STATUS', platform: 'instagram', accountId: 'acc-a' })
    const statusC = await dispatch(listener, { type: 'GET_BUFFER_STATUS', platform: 'instagram', accountId: 'acc-c' })

    expect(statusA.value.followers).toBe(2)
    expect(statusC.value.followers).toBe(1)
  })
})

describe('service worker: trust-boundary validation', () => {
  it('rejects a FRIENDSHIP_PAGE with an unknown platform', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')

    const res = await dispatch(listeners[0], {
      type: 'FRIENDSHIP_PAGE',
      platform: 'myspace',
      accountId: 'a',
      direction: 'followers',
      users: [],
    })
    expect(res.ok).toBe(false)
  })

  it('sanitizes page-controlled user lists: drops malformed rows, strips unsafe avatar URLs', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    const report = await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [
        user('legit'),
        { username: '' }, // dropped: no username
        { username: 42 }, // dropped: wrong type
         
        { username: 'sneaky', avatarUrl: 'javascript:alert(1)' }, // kept, avatar stripped
      ],
    })

    expect(report.ok).toBe(true)
    expect(report.value.followers).toBe(2) // legit + sneaky

    const save = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })
    const followers = save.value.diff.newFollowers as { username: string; avatarUrl: string }[]
    expect(followers.map((u) => u.username).sort()).toEqual(['legit', 'sneaky'])
    expect(followers.find((u) => u.username === 'sneaky')?.avatarUrl).toBe('')
  })
})

// The toolbar count was removed; what remains is one-time cleanup of what
// earlier versions left behind.
describe('service worker: legacy badge cleanup', () => {
  it('clears the stored counts and any painted badge on start-up', async () => {
    const { chrome, localStore } = createChromeMock()
    localStore.badgeCounts = { 'instagram:acc-a': 2 }
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    // The cleanup is fire-and-forget at module load: storage removal and the
    // badge clear are two awaits deep, so let the microtask chain drain.
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(localStore.badgeCounts).toBeUndefined()
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: '' })
  })

  it('never paints a count again, however many unfollows a save turns up', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1'), user('u2')],
    })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })

    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1')],
    })
    const save = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: false })
    expect(save.value.status).toBe('saved')
    expect(save.value.diff.lostFollowers).toHaveLength(1)

    // The one lost follower is still reported in the diff — it just no longer
    // reaches the toolbar icon.
    expect(chrome.action.setBadgeText).not.toHaveBeenCalledWith({ text: '1' })
  })
})

describe('service worker: account deletion', () => {
  it('removes snapshot history, buffered data, label, and lastAccounts pointer', async () => {
    const { chrome, listeners, localStore } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    // Two saved scans (so there's real snapshot history to delete) plus a
    // second, unrelated account whose data must survive the deletion.
    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      accountUsername: 'alice',
      direction: 'followers',
      users: [user('u1'), user('u2')],
    })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })
    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      accountUsername: 'alice',
      direction: 'followers',
      users: [user('u1')],
    })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: false })

    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'github',
      accountId: 'acc-b',
      accountUsername: 'bob',
      direction: 'followers',
      users: [user('u3')],
    })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'github', accountId: 'acc-b', force: true })

    const deleteResult = await dispatch(listener, { type: 'DELETE_ACCOUNT', platform: 'instagram', accountId: 'acc-a' })
    expect(deleteResult.ok).toBe(true)

    expect((localStore.accountLabels as Record<string, string>)['instagram:acc-a']).toBeUndefined()
    expect((localStore.lastAccounts as Record<string, string>).instagram).toBeUndefined()

    // The other account's tracked data is untouched.
    expect((localStore.accountLabels as Record<string, string>)['github:acc-b']).toBe('bob')
    const bufferStatus = await dispatch(listener, { type: 'GET_BUFFER_STATUS', platform: 'instagram', accountId: 'acc-a' })
    expect(bufferStatus.value.followers).toBe(0)
  })

  it('drops the deleted account\'s ignore list, keeping other accounts\' lists', async () => {
    const { chrome, listeners, localStore } = createChromeMock()
    localStore.ignoredUsers = { 'instagram:acc-a': ['brandbot'], 'github:acc-b': ['someone'] }
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')

    const res = await dispatch(listeners[0], { type: 'DELETE_ACCOUNT', platform: 'instagram', accountId: 'acc-a' })
    expect(res.ok).toBe(true)

    expect(localStore.ignoredUsers).toEqual({ 'github:acc-b': ['someone'] })
  })
})

describe('service worker: buffer reset', () => {
  it('discards only the in-progress scan, leaving saved history and other accounts untouched', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    // A previously saved scan (must survive the reset) plus new, in-progress
    // (unsaved) data that turned out to be wrong and needs discarding.
    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1')],
    })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })

    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'following',
      users: [user('mislabeled-1'), user('mislabeled-2')],
    })
    const statusBeforeReset = await dispatch(listener, {
      type: 'GET_BUFFER_STATUS',
      platform: 'instagram',
      accountId: 'acc-a',
    })
    expect(statusBeforeReset.value.following).toBe(2)

    const resetResult = await dispatch(listener, { type: 'RESET_BUFFER', platform: 'instagram', accountId: 'acc-a' })
    expect(resetResult.ok).toBe(true)

    const statusAfterReset = await dispatch(listener, {
      type: 'GET_BUFFER_STATUS',
      platform: 'instagram',
      accountId: 'acc-a',
    })
    expect(statusAfterReset.value).toEqual({ followers: 0, following: 0 })

    // The already-saved snapshot from before the reset is untouched.
    const save = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: false })
    expect(save.value.status).toBe('no-data')
  })

  it('rejects a reset for an unknown platform', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')

    const res = await dispatch(listeners[0], { type: 'RESET_BUFFER', platform: 'myspace', accountId: 'acc-a' })
    expect(res.ok).toBe(false)
  })
})

describe('service worker: expected-count validation (Instagram header stat)', () => {
  it('warns on a first-ever scan that undercounts against the profile\'s own stated total, even with no previous snapshot', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    // Instagram's header said "20 takipçi" but the scan only collected 5 —
    // the previous-snapshot ratio check can't catch this (there is no
    // previous snapshot yet) without the expected-count check added here.
    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1'), user('u2'), user('u3'), user('u4'), user('u5')],
      expectedCount: 20,
    })

    const save = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: false })
    expect(save.value.status).toBe('needs-confirmation')
    expect(save.value.status === 'needs-confirmation' && save.value.warning.expectedFollowers).toBe(20)
    expect(save.value.status === 'needs-confirmation' && save.value.warning.followers).toBe(5)
  })

  it('does not warn when the collected count matches the profile\'s stated total', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1'), user('u2')],
      expectedCount: 2,
    })

    const save = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: false })
    expect(save.value.status).toBe('saved')
  })

  it('force-save bypasses the warning and clears the stored expected count so it does not leak into the next scan', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const listener = listeners[0]

    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u1')],
      expectedCount: 20,
    })
    const forced = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })
    expect(forced.value.status).toBe('saved')

    // A fresh scan for the same account, with no expectedCount reported this
    // time, must not still be judged against the stale "20" from before.
    await dispatch(listener, {
      type: 'FRIENDSHIP_PAGE',
      platform: 'instagram',
      accountId: 'acc-a',
      direction: 'followers',
      users: [user('u2')],
    })
    const save = await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: false })
    expect(save.value.status).toBe('saved')
  })
})

describe('service worker: deleting a single saved scan', () => {
  it('removes only the targeted snapshot, leaving the rest of the account\'s history intact', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const { db } = await import('../lib/db')
    const listener = listeners[0]

    await dispatch(listener, { type: 'FRIENDSHIP_PAGE', platform: 'instagram', accountId: 'acc-a', direction: 'followers', users: [user('u1')] })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })
    await dispatch(listener, { type: 'FRIENDSHIP_PAGE', platform: 'instagram', accountId: 'acc-a', direction: 'followers', users: [user('u1'), user('u2')] })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })

    const saved = await db.snapshots.where('[platform+accountId]').equals(['instagram', 'acc-a']).sortBy('takenAt')
    expect(saved).toHaveLength(2)
    const oldestId = saved[0].id as number

    const res = await dispatch(listener, { type: 'DELETE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', snapshotId: oldestId })
    expect(res.ok).toBe(true)

    const remaining = await db.snapshots.where('[platform+accountId]').equals(['instagram', 'acc-a']).toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].followers.map((u) => u.username).sort()).toEqual(['u1', 'u2'])
  })

  it('re-points the account summary at the remaining snapshot after the latest one is deleted', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const { db } = await import('../lib/db')
    const listener = listeners[0]

    await dispatch(listener, { type: 'FRIENDSHIP_PAGE', platform: 'instagram', accountId: 'acc-a', direction: 'followers', users: [user('u1')] })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })
    await dispatch(listener, { type: 'FRIENDSHIP_PAGE', platform: 'instagram', accountId: 'acc-a', direction: 'followers', users: [user('u1'), user('u2')] })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })

    const saved = await db.snapshots.where('[platform+accountId]').equals(['instagram', 'acc-a']).sortBy('takenAt')
    const oldest = saved[0]
    const latestId = saved[1].id as number

    await dispatch(listener, { type: 'DELETE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', snapshotId: latestId })

    const summary = await db.accountSummaries.get(['instagram', 'acc-a'])
    expect(summary?.latestTakenAt).toBe(oldest.takenAt)
  })

  it('clears the account summary once the last remaining snapshot is deleted', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const { db } = await import('../lib/db')
    const listener = listeners[0]

    await dispatch(listener, { type: 'FRIENDSHIP_PAGE', platform: 'instagram', accountId: 'acc-a', direction: 'followers', users: [user('u1')] })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })

    const [only] = await db.snapshots.where('[platform+accountId]').equals(['instagram', 'acc-a']).toArray()
    await dispatch(listener, { type: 'DELETE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', snapshotId: only.id as number })

    const summary = await db.accountSummaries.get(['instagram', 'acc-a'])
    expect(summary).toBeUndefined()
  })

  it('refuses to delete a snapshot id that belongs to a different account', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')
    const { db } = await import('../lib/db')
    const listener = listeners[0]

    await dispatch(listener, { type: 'FRIENDSHIP_PAGE', platform: 'instagram', accountId: 'acc-a', direction: 'followers', users: [user('u1')] })
    await dispatch(listener, { type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'acc-a', force: true })

    const [snap] = await db.snapshots.where('[platform+accountId]').equals(['instagram', 'acc-a']).toArray()

    const res = await dispatch(listener, { type: 'DELETE_SNAPSHOT', platform: 'instagram', accountId: 'acc-b', snapshotId: snap.id as number })
    expect(res.ok).toBe(true) // the message itself is well-formed; the mismatch is a silent no-op, not an error

    const stillThere = await db.snapshots.get(snap.id as number)
    expect(stillThere).toBeDefined()
  })

  it('rejects a delete for an unknown platform', async () => {
    const { chrome, listeners } = createChromeMock()
    vi.stubGlobal('chrome', chrome)
    await import('./service-worker')

    const res = await dispatch(listeners[0], { type: 'DELETE_SNAPSHOT', platform: 'myspace', accountId: 'acc-a', snapshotId: 1 })
    expect(res.ok).toBe(false)
  })
})
