import { beforeEach, describe, expect, it } from 'vitest'
import {
  addBufferUsers,
  clearBuffer,
  countBufferUsers,
  db,
  deleteAccountSnapshots,
  deleteAccountSummary,
  deleteSnapshot,
  getBufferUsers,
  listKnownAccountIds,
  touchAccountSummary,
} from './db'
import type { SocialUser } from '../platforms/types'

function user(username: string, overrides: Partial<SocialUser> = {}): SocialUser {
  return { id: username, username, displayName: username, avatarUrl: '', isVerified: false, isPrivate: false, ...overrides }
}

beforeEach(async () => {
  await Promise.all([db.snapshots.clear(), db.bufferUsers.clear(), db.accountSummaries.clear()])
})

describe('scan buffer', () => {
  it('counts and returns what was added, per direction', async () => {
    await addBufferUsers('instagram', 'acc', 'followers', [user('a'), user('b')])
    await addBufferUsers('instagram', 'acc', 'following', [user('a')])

    await expect(countBufferUsers('instagram', 'acc', 'followers')).resolves.toBe(2)
    await expect(countBufferUsers('instagram', 'acc', 'following')).resolves.toBe(1)
    const followers = await getBufferUsers('instagram', 'acc', 'followers')
    expect(followers.map((u) => u.username).sort()).toEqual(['a', 'b'])
  })

  // The compound primary key lowercases the username segment, so a re-render
  // reporting the same person with different casing overwrites one row instead
  // of inflating the count with a duplicate.
  it('dedupes the same username reported under different casing', async () => {
    await addBufferUsers('instagram', 'acc', 'followers', [user('Alice')])
    await addBufferUsers('instagram', 'acc', 'followers', [user('alice')])

    await expect(countBufferUsers('instagram', 'acc', 'followers')).resolves.toBe(1)
  })

  it('keeps the displayed username casing of the latest report', async () => {
    await addBufferUsers('instagram', 'acc', 'followers', [user('Alice')])
    await addBufferUsers('instagram', 'acc', 'followers', [user('alice', { displayName: 'Alice Later' })])

    const [stored] = await getBufferUsers('instagram', 'acc', 'followers')
    expect(stored.username).toBe('alice')
    expect(stored.displayName).toBe('Alice Later')
  })

  it('clears only the targeted account, both directions', async () => {
    await addBufferUsers('instagram', 'acc-a', 'followers', [user('a')])
    await addBufferUsers('instagram', 'acc-a', 'following', [user('b')])
    await addBufferUsers('instagram', 'acc-b', 'followers', [user('c')])
    await addBufferUsers('github', 'acc-a', 'followers', [user('d')])

    await clearBuffer('instagram', 'acc-a')

    await expect(countBufferUsers('instagram', 'acc-a', 'followers')).resolves.toBe(0)
    await expect(countBufferUsers('instagram', 'acc-a', 'following')).resolves.toBe(0)
    await expect(countBufferUsers('instagram', 'acc-b', 'followers')).resolves.toBe(1)
    await expect(countBufferUsers('github', 'acc-a', 'followers')).resolves.toBe(1)
  })

  it('returns nothing for an account that was never buffered', async () => {
    await expect(getBufferUsers('github', 'nobody', 'followers')).resolves.toEqual([])
    await expect(countBufferUsers('github', 'nobody', 'followers')).resolves.toBe(0)
  })
})

describe('account summaries', () => {
  it('lists known accounts for one platform, most recently scanned first', async () => {
    await touchAccountSummary('instagram', 'older', 1_000)
    await touchAccountSummary('instagram', 'newer', 5_000)
    await touchAccountSummary('github', 'other-platform', 9_000)

    await expect(listKnownAccountIds('instagram')).resolves.toEqual(['newer', 'older'])
    await expect(listKnownAccountIds('github')).resolves.toEqual(['other-platform'])
  })

  it('drops an account from the list once its summary is deleted', async () => {
    await touchAccountSummary('instagram', 'acc', 1_000)
    await deleteAccountSummary('instagram', 'acc')

    await expect(listKnownAccountIds('instagram')).resolves.toEqual([])
  })
})

describe('deleteSnapshot', () => {
  async function seedTwoSnapshots() {
    const olderId = await db.snapshots.add({ platform: 'instagram', accountId: 'acc', takenAt: 1_000, followers: [user('a')], following: [] })
    const newerId = await db.snapshots.add({ platform: 'instagram', accountId: 'acc', takenAt: 2_000, followers: [user('a'), user('b')], following: [] })
    await touchAccountSummary('instagram', 'acc', 2_000)
    return { olderId, newerId }
  }

  it('deletes the targeted snapshot only', async () => {
    const { olderId } = await seedTwoSnapshots()

    await deleteSnapshot('instagram', 'acc', olderId)

    const remaining = await db.snapshots.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].takenAt).toBe(2_000)
  })

  it('re-points the summary at the newest remaining snapshot', async () => {
    const { newerId } = await seedTwoSnapshots()

    await deleteSnapshot('instagram', 'acc', newerId)

    await expect(db.accountSummaries.get(['instagram', 'acc'])).resolves.toMatchObject({ latestTakenAt: 1_000 })
  })

  it('removes the summary entirely once the last snapshot is gone', async () => {
    const { olderId, newerId } = await seedTwoSnapshots()

    await deleteSnapshot('instagram', 'acc', olderId)
    await deleteSnapshot('instagram', 'acc', newerId)

    await expect(db.accountSummaries.get(['instagram', 'acc'])).resolves.toBeUndefined()
  })

  // Ownership is re-checked against the stored row rather than trusted from the
  // caller, so a stale id can't delete another account's scan.
  it('ignores a snapshot id that belongs to a different account', async () => {
    const { newerId } = await seedTwoSnapshots()

    await deleteSnapshot('instagram', 'someone-else', newerId)

    await expect(db.snapshots.get(newerId)).resolves.toBeDefined()
  })

  it('ignores an id that does not exist at all', async () => {
    await seedTwoSnapshots()

    await deleteSnapshot('instagram', 'acc', 999_999)

    await expect(db.snapshots.count()).resolves.toBe(2)
  })
})

describe('deleteAccountSnapshots', () => {
  it('removes every snapshot for one account and leaves the others', async () => {
    await db.snapshots.bulkAdd([
      { platform: 'instagram', accountId: 'acc-a', takenAt: 1, followers: [], following: [] },
      { platform: 'instagram', accountId: 'acc-a', takenAt: 2, followers: [], following: [] },
      { platform: 'instagram', accountId: 'acc-b', takenAt: 3, followers: [], following: [] },
    ])

    await deleteAccountSnapshots('instagram', 'acc-a')

    const remaining = await db.snapshots.toArray()
    expect(remaining.map((snap) => snap.accountId)).toEqual(['acc-b'])
  })
})
