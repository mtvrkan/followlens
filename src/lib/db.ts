import Dexie, { type Table } from 'dexie'
import type { FriendshipDirection, PlatformId, SocialUser } from '../platforms/types'
import type { Snapshot } from './types'

/** One buffered user from an in-progress (not yet saved) scan. */
export interface BufferUserRow {
  platform: PlatformId
  accountId: string
  direction: FriendshipDirection
  username: string
  user: SocialUser
}

/** Lightweight per-account rollup — just enough to list/sort known accounts. */
export interface AccountSummary {
  platform: PlatformId
  accountId: string
  latestTakenAt: number
}

class FollowLensDB extends Dexie {
  snapshots!: Table<Snapshot, number>
  bufferUsers!: Table<BufferUserRow, [PlatformId, string, FriendshipDirection, string]>
  accountSummaries!: Table<AccountSummary, [PlatformId, string]>

  constructor() {
    super('followlens')
    this.version(1).stores({
      snapshots: '++id, platform, accountId, [platform+accountId], takenAt',
    })
    // v2: the in-progress scan buffer moves out of chrome.storage.session —
    // its 10 MB quota is exceeded by the data-URL avatars of a few thousand
    // followers, which made large scans fail wholesale. IndexedDB has no
    // such fixed ceiling, and the compound primary key dedupes re-reported
    // users for free (bulkPut overwrites the same [...+username] row).
    this.version(2).stores({
      snapshots: '++id, platform, accountId, [platform+accountId], takenAt',
      bufferUsers: '[platform+accountId+direction+username], [platform+accountId+direction], [platform+accountId]',
    })
    // v3: dashboard's account picker used to list every known account by
    // loading ALL of that platform's snapshots — full followers/following
    // arrays (with avatar data URLs) included — just to read accountId and
    // takenAt off each one. This rollup carries only what the picker needs,
    // kept in sync by touchAccountSummary/deleteAccountSummary. The upgrade
    // backfills it once from existing history so accounts scanned before
    // this version don't disappear from the picker.
    this.version(3).stores({
      snapshots: '++id, platform, accountId, [platform+accountId], takenAt',
      bufferUsers: '[platform+accountId+direction+username], [platform+accountId+direction], [platform+accountId]',
      accountSummaries: '[platform+accountId], platform',
    }).upgrade(async (tx) => {
      const latest = new Map<string, AccountSummary>()
      await tx.table('snapshots').each((snap: Snapshot) => {
        const key = `${snap.platform}:${snap.accountId}`
        const current = latest.get(key)
        if (!current || snap.takenAt > current.latestTakenAt) {
          latest.set(key, { platform: snap.platform, accountId: snap.accountId, latestTakenAt: snap.takenAt })
        }
      })
      await tx.table('accountSummaries').bulkPut([...latest.values()])
    })
  }
}

export const db = new FollowLensDB()

export async function addBufferUsers(
  platform: PlatformId,
  accountId: string,
  direction: FriendshipDirection,
  users: SocialUser[],
): Promise<void> {
  // The compound key's username segment is lowercased so re-reporting the
  // same account with different casing (seen on some Instagram re-renders)
  // overwrites the same row instead of creating a second one — bulkPut only
  // dedupes an *exact* key match, and usernames are case-insensitive
  // identifiers anyway. `user.username` (the displayed value) keeps its
  // original casing.
  await db.bufferUsers.bulkPut(users.map((user) => ({ platform, accountId, direction, username: user.username.toLowerCase(), user })))
}

export function countBufferUsers(platform: PlatformId, accountId: string, direction: FriendshipDirection): Promise<number> {
  return db.bufferUsers.where('[platform+accountId+direction]').equals([platform, accountId, direction]).count()
}

export async function getBufferUsers(
  platform: PlatformId,
  accountId: string,
  direction: FriendshipDirection,
): Promise<SocialUser[]> {
  const rows = await db.bufferUsers.where('[platform+accountId+direction]').equals([platform, accountId, direction]).toArray()
  return rows.map((row) => row.user)
}

/** Drops the whole in-progress scan for one account (after a save, or when forgetting the account). */
export async function clearBuffer(platform: PlatformId, accountId: string): Promise<void> {
  await db.bufferUsers.where('[platform+accountId]').equals([platform, accountId]).delete()
}

/** Permanently removes every saved snapshot for one platform+account. */
export async function deleteAccountSnapshots(platform: PlatformId, accountId: string): Promise<void> {
  await db.snapshots.where('[platform+accountId]').equals([platform, accountId]).delete()
}

/**
 * Permanently removes one saved snapshot (a single point-in-time scan), not
 * the whole account's history. `platform`/`accountId` are checked against
 * the row itself rather than trusted from the caller, so a stale or
 * mistyped id can't be used to delete a snapshot belonging to a different
 * account. Re-derives accountSummaries' `latestTakenAt` rollup afterwards —
 * deleting the most recent scan would otherwise leave it pointing at a
 * takenAt that no longer has a matching row.
 */
export async function deleteSnapshot(platform: PlatformId, accountId: string, snapshotId: number): Promise<void> {
  const target = await db.snapshots.get(snapshotId)
  if (!target || target.platform !== platform || target.accountId !== accountId) return

  await db.snapshots.delete(snapshotId)

  const remaining = await db.snapshots.where('[platform+accountId]').equals([platform, accountId]).toArray()
  if (remaining.length === 0) {
    await deleteAccountSummary(platform, accountId)
  } else {
    await touchAccountSummary(platform, accountId, Math.max(...remaining.map((snap) => snap.takenAt)))
  }
}

/** Records that a snapshot was just saved, for the dashboard's account picker (see AccountSummary). */
export async function touchAccountSummary(platform: PlatformId, accountId: string, takenAt: number): Promise<void> {
  await db.accountSummaries.put({ platform, accountId, latestTakenAt: takenAt })
}

/** Drops the rollup entry once an account's snapshot history is deleted. */
export async function deleteAccountSummary(platform: PlatformId, accountId: string): Promise<void> {
  await db.accountSummaries.delete([platform, accountId])
}

/** Every accountId ever scanned on `platform`, most recently scanned first. */
export async function listKnownAccountIds(platform: PlatformId): Promise<string[]> {
  const rows = await db.accountSummaries.where('platform').equals(platform).toArray()
  return rows.sort((a, b) => b.latestTakenAt - a.latestTakenAt).map((row) => row.accountId)
}
