import type { Table } from 'dexie'
import { adaptersById } from '../platforms/registry'
import type { PlatformId, Snapshot, SocialUser } from './types'
import { err, ok, type Result } from '../shared/result'

export interface BackupFile {
  version: 1
  exportedAt?: string
  accountLabels?: Record<string, string>
  snapshots: Snapshot[]
}

export interface ImportBackupResult {
  importedSnapshots: number
  skippedSnapshots: number
  restoredLabels: number
}

const MAX_STRING_LENGTH = 2048

// A backup file is user-chosen, but it is still untrusted input parsed on the
// options page's main thread: `snapshots.every(isSnapshot)` walks every user
// of every snapshot, so a file claiming millions of them freezes the tab with
// no way out. These ceilings are far above any real export (a heavy user is
// tens of snapshots and a few thousand users each) and turn "hangs forever"
// into a clean `too-large` the UI already reports as an invalid backup.
const MAX_SNAPSHOTS_PER_BACKUP = 10_000
const MAX_USERS_PER_SNAPSHOT = 200_000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isSafeString(value: unknown, maxLength = MAX_STRING_LENGTH): value is string {
  return typeof value === 'string' && value.length <= maxLength
}

function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && value in adaptersById
}

function isSocialUser(value: unknown): value is SocialUser {
  if (!isPlainObject(value)) return false
  return (
    isSafeString(value.id) &&
    isSafeString(value.username, 256) &&
    isSafeString(value.displayName) &&
    isSafeString(value.avatarUrl, 64_000) &&
    typeof value.isVerified === 'boolean' &&
    // Optional: backups written before isPrivate existed have no such field —
    // rejecting them here would make every pre-existing backup unrestorable.
    (value.isPrivate === undefined || typeof value.isPrivate === 'boolean')
  )
}

/**
 * Platforms this extension used to support and no longer does. Listed by name
 * rather than inferred from "not a current PlatformId", because those are two
 * different things: a snapshot from a retired platform is a valid backup of
 * data we simply cannot show any more, while an unrecognized platform string
 * means the file is not what it claims to be. Treating every unknown value as
 * retired would let a wholly bogus backup import as an empty success.
 */
const RETIRED_PLATFORMS = new Set(['tiktok', 'x'])

/**
 * Skipped rather than rejected, so a backup taken while TikTok/X still existed
 * still restores everything else in it — refusing the whole file over a
 * retired platform would strand the user's entire Instagram and GitHub history.
 */
function isRetiredPlatformSnapshot(value: unknown): boolean {
  return isPlainObject(value) && typeof value.platform === 'string' && RETIRED_PLATFORMS.has(value.platform)
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!isPlainObject(value)) return false
  return (
    isPlatformId(value.platform) &&
    isSafeString(value.accountId, 256) &&
    (value.accountUsername === undefined || isSafeString(value.accountUsername, 256)) &&
    typeof value.takenAt === 'number' &&
    Number.isFinite(value.takenAt) &&
    value.takenAt > 0 &&
    Array.isArray(value.followers) &&
    Array.isArray(value.following) &&
    value.followers.length <= MAX_USERS_PER_SNAPSHOT &&
    value.following.length <= MAX_USERS_PER_SNAPSHOT &&
    value.followers.every(isSocialUser) &&
    value.following.every(isSocialUser)
  )
}

function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  const normalized = { ...snapshot }
  delete normalized.id
  return normalized
}

function normalizeLabels(value: unknown): Record<string, string> {
  if (!isPlainObject(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, label]) => isSafeString(key, 512) && isSafeString(label, 256))
      .map(([key, label]) => [key, label as string]),
  )
}

export function parseBackupJson(text: string): Result<BackupFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return err('invalid-json')
  }

  if (!isPlainObject(parsed)) return err('invalid-shape')
  if (parsed.version !== 1) return err('unsupported-version')
  if (!Array.isArray(parsed.snapshots)) return err('missing-snapshots')
  // Checked before the per-snapshot walk below, which is what actually costs
  // time on a huge file.
  if (parsed.snapshots.length > MAX_SNAPSHOTS_PER_BACKUP) return err('too-large')

  // Dropped, not rejected — see isRetiredPlatformSnapshot. Anything else that
  // fails validation still fails the whole file: a malformed snapshot means
  // the backup is not what it claims to be, which is worth refusing.
  const supported = parsed.snapshots.filter((snapshot) => !isRetiredPlatformSnapshot(snapshot))
  if (!supported.every(isSnapshot)) return err('invalid-snapshot')

  return ok({
    version: 1,
    exportedAt: isSafeString(parsed.exportedAt, 128) ? parsed.exportedAt : undefined,
    accountLabels: normalizeLabels(parsed.accountLabels),
    snapshots: supported.map(normalizeSnapshot),
  })
}

export async function importBackup(
  backup: BackupFile,
  tables: {
    snapshots: Table<Snapshot, number>
    accountSummaries: Table<{ platform: PlatformId; accountId: string; latestTakenAt: number }, [PlatformId, string]>
  },
  storage: Pick<typeof chrome.storage.local, 'get' | 'set'>,
): Promise<ImportBackupResult> {
  const existing = await tables.snapshots.toArray()
  const existingKeys = new Set(existing.map((snap) => `${snap.platform}:${snap.accountId}:${snap.takenAt}`))
  const snapshotsToImport = backup.snapshots.filter((snap) => !existingKeys.has(`${snap.platform}:${snap.accountId}:${snap.takenAt}`))

  if (snapshotsToImport.length > 0) {
    await tables.snapshots.bulkAdd(snapshotsToImport)
  }

  const latestByAccount = new Map<string, { platform: PlatformId; accountId: string; latestTakenAt: number }>()
  for (const snap of [...existing, ...snapshotsToImport]) {
    const key = `${snap.platform}:${snap.accountId}`
    const current = latestByAccount.get(key)
    if (!current || snap.takenAt > current.latestTakenAt) {
      latestByAccount.set(key, { platform: snap.platform, accountId: snap.accountId, latestTakenAt: snap.takenAt })
    }
  }
  if (latestByAccount.size > 0) {
    await tables.accountSummaries.bulkPut([...latestByAccount.values()])
  }

  const labels = backup.accountLabels ?? {}
  const restoredLabels = Object.keys(labels).length
  if (restoredLabels > 0) {
    const { accountLabels } = await storage.get('accountLabels')
    await storage.set({ accountLabels: { ...(isPlainObject(accountLabels) ? accountLabels : {}), ...labels } })
  }

  return {
    importedSnapshots: snapshotsToImport.length,
    skippedSnapshots: backup.snapshots.length - snapshotsToImport.length,
    restoredLabels,
  }
}
