import {
  addBufferUsers,
  clearBuffer,
  countBufferUsers,
  db,
  deleteAccountSnapshots,
  deleteAccountSummary,
  deleteSnapshot,
  getBufferUsers,
  touchAccountSummary,
} from '../lib/db'
import { diffSnapshots } from '../lib/diff'
import { accountKey } from '../lib/account-key'
import { deleteIgnoredUsernames } from '../lib/ignore-list'
import {
  isAccountCommand,
  isDeleteSnapshotMessage,
  isFriendshipPageMessage,
  sanitizeUsers,
  type BufferStatus,
  type FriendshipPageMessage,
} from '../shared/messages'
import { err, ok, type Result } from '../shared/result'
import type { SaveSnapshotResult, Snapshot } from '../lib/types'
import type { FriendshipDirection, PlatformId } from '../platforms/types'

// A scan finding less than this fraction of the previous one's followers/
// following is treated as incomplete (list not fully scrolled) rather than
// a mass-unfollow event.
const MIN_COMPLETE_RATIO = 0.5
// Below this size, normal day-to-day fluctuation can easily cross the ratio
// threshold, so the guard is skipped to avoid nagging small accounts.
const MIN_SIZE_TO_GUARD = 10

// Multiple platforms are commonly tracked at once (one tab each, all
// auto-scrolling in parallel), so handleFriendshipPage/handleSaveSnapshot can
// otherwise interleave: both read the buffer/local storage before either
// writes it back, and the second write silently drops the first one's data.
// Chaining every call through this queue makes each handler's read-modify-write
// atomic relative to the others.
let messageQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = messageQueue.then(task, task)
  messageQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

async function handleFriendshipPage(message: FriendshipPageMessage): Promise<BufferStatus> {
  const key = accountKey(message.platform, message.accountId)

  // Users originate from page-controlled data (intercepted JSON / parsed
  // DOM) — field-level validation happens here, at the trust boundary.
  await addBufferUsers(message.platform, message.accountId, message.direction, sanitizeUsers(message.users))

  // Remember the most recently seen account per platform so the
  // popup/dashboard know what to show without needing extra tab/cookie
  // permissions, and which platform to default to.
  const { lastAccounts, accountLabels } = await chrome.storage.local.get(['lastAccounts', 'accountLabels'])
  const nextLastAccounts = {
    ...(lastAccounts as Partial<Record<PlatformId, string>> | undefined),
    [message.platform]: message.accountId,
  }
  const updates: Record<string, unknown> = { lastAccounts: nextLastAccounts, lastPlatform: message.platform }

  // Several accounts on the same platform are tracked separately by
  // accountId already (the DB key is [platform+accountId]) — this label
  // map is just what lets the UI show "@handle" instead of a raw numeric id
  // when offering a choice between them.
  if (message.accountUsername) {
    updates.accountLabels = {
      ...(accountLabels as Record<string, string> | undefined),
      [key]: message.accountUsername,
    }
  }

  await chrome.storage.local.set(updates)

  if (message.expectedCount != null) {
    await setExpectedCount(key, message.direction, message.expectedCount)
  }

  const expected = await getExpectedCounts(key)
  return {
    followers: await countBufferUsers(message.platform, message.accountId, 'followers'),
    following: await countBufferUsers(message.platform, message.accountId, 'following'),
    expectedFollowers: expected?.followers,
    expectedFollowing: expected?.following,
  }
}

function isIncomplete(currentCount: number, previousCount: number): boolean {
  return previousCount >= MIN_SIZE_TO_GUARD && currentCount < previousCount * MIN_COMPLETE_RATIO
}

interface ExpectedCounts {
  followers?: number
  following?: number
}

// The platform's own stated total per direction (Instagram's "131 takipçi"
// profile stat), refreshed on every FRIENDSHIP_PAGE report while a scan is
// running. Kept outside IndexedDB (chrome.storage.local, alongside
// accountLabels/lastAccounts) since it's a small live-state value, not
// scan data — see getExpectedCounts/setExpectedCount/clearExpectedCounts.
async function getExpectedCounts(key: string): Promise<ExpectedCounts | undefined> {
  const { expectedCounts } = await chrome.storage.local.get('expectedCounts')
  return (expectedCounts as Record<string, ExpectedCounts> | undefined)?.[key]
}

async function setExpectedCount(key: string, direction: FriendshipDirection, value: number): Promise<void> {
  const { expectedCounts } = await chrome.storage.local.get('expectedCounts')
  const next: Record<string, ExpectedCounts> = { ...(expectedCounts as Record<string, ExpectedCounts> | undefined) }
  next[key] = { ...next[key], [direction]: value }
  await chrome.storage.local.set({ expectedCounts: next })
}

async function clearExpectedCounts(key: string): Promise<void> {
  const { expectedCounts } = await chrome.storage.local.get('expectedCounts')
  const next = { ...(expectedCounts as Record<string, ExpectedCounts> | undefined) }
  delete next[key]
  await chrome.storage.local.set({ expectedCounts: next })
}

async function handleSaveSnapshot(platform: PlatformId, accountId: string, force: boolean): Promise<SaveSnapshotResult> {
  const key = accountKey(platform, accountId)
  const followers = await getBufferUsers(platform, accountId, 'followers')
  const following = await getBufferUsers(platform, accountId, 'following')
  if (followers.length === 0 && following.length === 0) return { status: 'no-data' }

  const { accountLabels } = await chrome.storage.local.get('accountLabels')
  const accountUsername = (accountLabels as Record<string, string> | undefined)?.[key]

  const current: Snapshot = {
    platform,
    accountId,
    accountUsername,
    takenAt: Date.now(),
    followers,
    following,
  }

  const previous = await db.snapshots.where('[platform+accountId]').equals([platform, accountId]).last()
  // Guards a scan against the platform's own displayed total too, not just
  // history — a first-ever scan has no `previous` snapshot to compare
  // against, so without this an under-scrolled list (e.g. the platform's
  // lazy-load stalled) saved silently with a wrong, too-low count and
  // nothing ever flagged it. isIncomplete's own MIN_SIZE_TO_GUARD floor
  // already makes an unset expected count (0) a no-op below.
  const expected = await getExpectedCounts(key)

  if (!force) {
    const incomplete =
      (!!previous &&
        (isIncomplete(current.followers.length, previous.followers.length) ||
          isIncomplete(current.following.length, previous.following.length))) ||
      isIncomplete(current.followers.length, expected?.followers ?? 0) ||
      isIncomplete(current.following.length, expected?.following ?? 0)

    if (incomplete) {
      return {
        status: 'needs-confirmation',
        warning: {
          followers: current.followers.length,
          following: current.following.length,
          previousFollowers: previous?.followers.length ?? current.followers.length,
          previousFollowing: previous?.following.length ?? current.following.length,
          expectedFollowers: expected?.followers,
          expectedFollowing: expected?.following,
        },
      }
    }
  }

  const diff = diffSnapshots(previous, current)
  await db.snapshots.add(current)
  await touchAccountSummary(platform, accountId, current.takenAt)
  await clearBuffer(platform, accountId)
  await clearExpectedCounts(key)

  return { status: 'saved', diff }
}

// The toolbar icon used to carry a red count of lost followers, summed across
// every tracked account. It was removed: the number was only ever as fresh as
// the last saved scan — which is a manual action here, not something that
// happens in the background — so a badge that looked like a live notification
// was in fact showing however stale the last save was, and had no way to ever
// clear itself. Dropping it also removes the storage key, the startup restore
// it needed (badge text is per-session browser state Chrome never replays),
// and the whole class of "the badge disagrees with the dashboard" bugs.
const LEGACY_BADGE_COUNTS_KEY = 'badgeCounts'

/**
 * Clears what earlier versions left behind: the stored per-account counts, and
 * the badge itself if this session still has one painted. Runs once per
 * worker start-up rather than on install only, because an install event never
 * fires for a user who simply gets the update.
 */
async function clearLegacyBadge(): Promise<void> {
  try {
    await chrome.storage.local.remove(LEGACY_BADGE_COUNTS_KEY)
    await chrome.action.setBadgeText({ text: '' })
  } catch (error) {
    // Purely cosmetic cleanup — never worth failing a worker wake-up over.
    console.error('[FollowLens] clearing the legacy badge failed:', error)
  }
}

async function handleGetBufferStatus(platform: PlatformId, accountId: string): Promise<BufferStatus> {
  const expected = await getExpectedCounts(accountKey(platform, accountId))
  return {
    followers: await countBufferUsers(platform, accountId, 'followers'),
    following: await countBufferUsers(platform, accountId, 'following'),
    expectedFollowers: expected?.followers,
    expectedFollowing: expected?.following,
  }
}

// Discards an in-progress (not yet saved) scan without touching previously
// saved snapshot history — the escape hatch for a scan that collected
// wrong/mislabeled data partway through, so the user can start over clean.
async function handleResetBuffer(platform: PlatformId, accountId: string): Promise<void> {
  await clearBuffer(platform, accountId)
  await clearExpectedCounts(accountKey(platform, accountId))
}

// Permanently forgets one tracked account: its snapshot history, any
// buffered-but-unsaved scan in progress, its display label, its ignore list,
// and — if it was the most recently viewed account for this platform — that
// pointer too, so the UI doesn't keep referring to data that no longer exists.
async function handleDeleteAccount(platform: PlatformId, accountId: string): Promise<void> {
  await deleteAccountSnapshots(platform, accountId)
  await deleteAccountSummary(platform, accountId)
  await clearBuffer(platform, accountId)

  const key = accountKey(platform, accountId)
  await clearExpectedCounts(key)
  await deleteIgnoredUsernames(platform, accountId)

  const { accountLabels, lastAccounts } = await chrome.storage.local.get(['accountLabels', 'lastAccounts'])
  const nextAccountLabels = { ...(accountLabels as Record<string, string> | undefined) }
  delete nextAccountLabels[key]
  const nextLastAccounts = { ...(lastAccounts as Partial<Record<PlatformId, string>> | undefined) }
  if (nextLastAccounts[platform] === accountId) delete nextLastAccounts[platform]

  await chrome.storage.local.set({
    accountLabels: nextAccountLabels,
    lastAccounts: nextLastAccounts,
  })
}

/** Permanently removes one saved snapshot (a single point-in-time scan), not the whole account's history. */
async function handleDeleteSnapshot(platform: PlatformId, accountId: string, snapshotId: number): Promise<void> {
  await deleteSnapshot(platform, accountId, snapshotId)
}

/** Runs a handler, converting its outcome to the Result envelope every sender expects. */
function respondWith<T>(label: string, sendResponse: (response: Result<T>) => void, task: () => Promise<T>): true {
  enqueue(task)
    .then((value) => sendResponse(ok(value)))
    .catch((error) => {
      console.error(`[FollowLens] ${label} failed:`, error)
      sendResponse(err(error instanceof Error ? error.message : 'handler-failed'))
    })
  return true
}

// First-run onboarding: shown once, on install only (not on updates).
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Unhandled here it would be an error on the worker itself; the onboarding
    // page simply not opening is the acceptable outcome.
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') }).catch(() => undefined)
  }
})

void clearLegacyBadge()

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const type = (message as { type?: unknown })?.type

  if (type === 'FRIENDSHIP_PAGE') {
    if (!isFriendshipPageMessage(message)) {
      sendResponse(err('invalid-message'))
      return true
    }
    return respondWith('handleFriendshipPage', sendResponse, () => handleFriendshipPage(message))
  }

  // Each of these four shares a shape (platform + accountId): a message
  // whose type matches but fails validation (unknown platform, empty
  // accountId) must still get a response — otherwise the sender is left
  // waiting on a promise that never resolves, since returning `false`
  // without calling sendResponse signals "no listener handled this".
  if (type === 'SAVE_SNAPSHOT') {
    if (!isAccountCommand(message, 'SAVE_SNAPSHOT')) {
      sendResponse(err('invalid-message'))
      return true
    }
    const force = (message as { force?: unknown }).force === true
    return respondWith('handleSaveSnapshot', sendResponse, () => handleSaveSnapshot(message.platform, message.accountId, force))
  }

  if (type === 'DELETE_ACCOUNT') {
    if (!isAccountCommand(message, 'DELETE_ACCOUNT')) {
      sendResponse(err('invalid-message'))
      return true
    }
    // Resolves to null (not undefined): message responses are JSON-serialized,
    // and a stripped-out `value: undefined` would read as a malformed Result.
    return respondWith('handleDeleteAccount', sendResponse, () =>
      handleDeleteAccount(message.platform, message.accountId).then(() => null),
    )
  }

  if (type === 'DELETE_SNAPSHOT') {
    if (!isDeleteSnapshotMessage(message)) {
      sendResponse(err('invalid-message'))
      return true
    }
    return respondWith('handleDeleteSnapshot', sendResponse, () =>
      handleDeleteSnapshot(message.platform, message.accountId, message.snapshotId).then(() => null),
    )
  }

  if (type === 'GET_BUFFER_STATUS') {
    if (!isAccountCommand(message, 'GET_BUFFER_STATUS')) {
      sendResponse(err('invalid-message'))
      return true
    }
    return respondWith('handleGetBufferStatus', sendResponse, () => handleGetBufferStatus(message.platform, message.accountId))
  }

  if (type === 'RESET_BUFFER') {
    if (!isAccountCommand(message, 'RESET_BUFFER')) {
      sendResponse(err('invalid-message'))
      return true
    }
    return respondWith('handleResetBuffer', sendResponse, () =>
      handleResetBuffer(message.platform, message.accountId).then(() => null),
    )
  }

  return false
})
