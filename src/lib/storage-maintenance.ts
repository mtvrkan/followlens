import type { Table } from 'dexie'
import type { AccountSummary, BufferUserRow } from './db'
import { db } from './db'
import type { PlatformId, Snapshot } from './types'

export interface StorageUsageReport {
  snapshots: number
  bufferRows: number
  accounts: number
  snapshotBytes: number
  bufferBytes: number
  localBytes: number
  totalBytes: number
}

export interface RetentionResult {
  deletedSnapshots: number
  keptSnapshots: number
}

interface MaintenanceTables {
  snapshots: Table<Snapshot, number>
  bufferUsers: Table<BufferUserRow, [PlatformId, string, 'followers' | 'following', string]>
  accountSummaries: Table<AccountSummary, [PlatformId, string]>
}

function byteSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export async function buildStorageUsageReport(
  tables: MaintenanceTables = db,
  storage: Pick<typeof chrome.storage.local, 'get'> = chrome.storage.local,
): Promise<StorageUsageReport> {
  const [snapshots, bufferRows, summaries, local] = await Promise.all([
    tables.snapshots.toArray(),
    tables.bufferUsers.toArray(),
    tables.accountSummaries.toArray(),
    storage.get(['accountLabels', 'lastAccounts', 'lastPlatform', 'ignoredUsers']),
  ])

  const snapshotBytes = byteSize(snapshots)
  const bufferBytes = byteSize(bufferRows)
  const localBytes = byteSize(local)

  return {
    snapshots: snapshots.length,
    bufferRows: bufferRows.length,
    accounts: summaries.length,
    snapshotBytes,
    bufferBytes,
    localBytes,
    totalBytes: snapshotBytes + bufferBytes + localBytes,
  }
}

export async function applySnapshotRetention(
  keepPerAccount: number,
  tables: Pick<MaintenanceTables, 'snapshots' | 'accountSummaries'> = db,
): Promise<RetentionResult> {
  const keep = Math.max(1, Math.floor(keepPerAccount))
  const snapshots = await tables.snapshots.orderBy('takenAt').toArray()
  const byAccount = new Map<string, Snapshot[]>()

  for (const snapshot of snapshots) {
    const key = `${snapshot.platform}:${snapshot.accountId}`
    byAccount.set(key, [...(byAccount.get(key) ?? []), snapshot])
  }

  const idsToDelete: number[] = []
  let keptSnapshots = 0
  const latestSummaries = new Map<string, AccountSummary>()

  for (const accountSnapshots of byAccount.values()) {
    const sorted = [...accountSnapshots].sort((a, b) => a.takenAt - b.takenAt)
    const keepSet = new Set(
      sorted
        .slice(-keep)
        .map((snapshot) => snapshot.id)
        .filter((id): id is number => typeof id === 'number'),
    )
    keptSnapshots += Math.min(sorted.length, keep)
    for (const snapshot of sorted) {
      if (typeof snapshot.id === 'number' && !keepSet.has(snapshot.id)) idsToDelete.push(snapshot.id)
    }
    const latest = sorted[sorted.length - 1]
    latestSummaries.set(`${latest.platform}:${latest.accountId}`, {
      platform: latest.platform,
      accountId: latest.accountId,
      latestTakenAt: latest.takenAt,
    })
  }

  if (idsToDelete.length > 0) {
    await tables.snapshots.bulkDelete(idsToDelete)
  }
  if (latestSummaries.size > 0) {
    await tables.accountSummaries.bulkPut([...latestSummaries.values()])
  }

  return { deletedSnapshots: idsToDelete.length, keptSnapshots }
}
