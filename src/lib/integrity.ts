import type { Table } from 'dexie'
import type { AccountSummary, BufferUserRow } from './db'
import { db } from './db'
import type { PlatformId, Snapshot, SocialUser } from './types'

export interface DataIntegrityReport {
  checkedAt: number
  snapshots: number
  duplicateSnapshots: number
  invalidSnapshots: number
  staleAccountSummaries: number
  missingAccountSummaries: number
  orphanedBufferRows: number
}

interface IntegrityTables {
  snapshots: Table<Snapshot, number>
  accountSummaries: Table<AccountSummary, [PlatformId, string]>
  bufferUsers: Table<BufferUserRow, [PlatformId, string, 'followers' | 'following', string]>
}

function accountKey(platform: PlatformId, accountId: string): string {
  return `${platform}:${accountId}`
}

function isValidUser(user: unknown): user is SocialUser {
  if (!user || typeof user !== 'object') return false
  const value = user as Record<string, unknown>
  return (
    typeof value.id === 'string' &&
    typeof value.username === 'string' &&
    value.username.length > 0 &&
    typeof value.displayName === 'string' &&
    typeof value.avatarUrl === 'string' &&
    typeof value.isVerified === 'boolean' &&
    // Optional: snapshots saved before isPrivate existed have no such field —
    // flagging every pre-existing one as corrupt would be wrong.
    (value.isPrivate === undefined || typeof value.isPrivate === 'boolean')
  )
}

function isValidSnapshot(snapshot: Snapshot): boolean {
  return (
    typeof snapshot.accountId === 'string' &&
    snapshot.accountId.length > 0 &&
    typeof snapshot.takenAt === 'number' &&
    Number.isFinite(snapshot.takenAt) &&
    Array.isArray(snapshot.followers) &&
    Array.isArray(snapshot.following) &&
    snapshot.followers.every(isValidUser) &&
    snapshot.following.every(isValidUser)
  )
}

export async function buildDataIntegrityReport(tables: IntegrityTables = db): Promise<DataIntegrityReport> {
  const [snapshots, summaries, bufferRows] = await Promise.all([
    tables.snapshots.toArray(),
    tables.accountSummaries.toArray(),
    tables.bufferUsers.toArray(),
  ])

  const snapshotIdentityCounts = new Map<string, number>()
  const snapshotAccountKeys = new Set<string>()
  let invalidSnapshots = 0
  for (const snapshot of snapshots) {
    if (!isValidSnapshot(snapshot)) invalidSnapshots += 1
    snapshotAccountKeys.add(accountKey(snapshot.platform, snapshot.accountId))
    const identity = `${snapshot.platform}:${snapshot.accountId}:${snapshot.takenAt}`
    snapshotIdentityCounts.set(identity, (snapshotIdentityCounts.get(identity) ?? 0) + 1)
  }

  const duplicateSnapshots = [...snapshotIdentityCounts.values()].reduce((count, duplicates) => count + Math.max(0, duplicates - 1), 0)
  const summaryAccountKeys = new Set(summaries.map((summary) => accountKey(summary.platform, summary.accountId)))
  const staleAccountSummaries = summaries.filter((summary) => !snapshotAccountKeys.has(accountKey(summary.platform, summary.accountId))).length
  const missingAccountSummaries = [...snapshotAccountKeys].filter((key) => !summaryAccountKeys.has(key)).length
  const knownAccountKeys = new Set([...snapshotAccountKeys, ...summaryAccountKeys])
  const orphanedBufferRows = bufferRows.filter((row) => !knownAccountKeys.has(accountKey(row.platform, row.accountId))).length

  return {
    checkedAt: Date.now(),
    snapshots: snapshots.length,
    duplicateSnapshots,
    invalidSnapshots,
    staleAccountSummaries,
    missingAccountSummaries,
    orphanedBufferRows,
  }
}

export function hasIntegrityIssues(report: DataIntegrityReport): boolean {
  return (
    report.duplicateSnapshots > 0 ||
    report.invalidSnapshots > 0 ||
    report.staleAccountSummaries > 0 ||
    report.missingAccountSummaries > 0 ||
    report.orphanedBufferRows > 0
  )
}
