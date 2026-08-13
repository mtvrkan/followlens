import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { applySnapshotRetention, buildStorageUsageReport, formatBytes } from './storage-maintenance'

const user = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: '',
  isVerified: false,
  isPrivate: false,
}

describe('storage maintenance', () => {
  beforeEach(async () => {
    await db.snapshots.clear()
    await db.accountSummaries.clear()
    await db.bufferUsers.clear()
  })

  it('formats byte counts', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.0 MB')
  })

  it('builds a storage usage report', async () => {
    await db.snapshots.add({
      platform: 'instagram',
      accountId: 'acct',
      takenAt: 100,
      followers: [user],
      following: [],
    })
    await db.bufferUsers.put({ platform: 'instagram', accountId: 'acct', direction: 'followers', username: 'alice', user })
    await db.accountSummaries.put({ platform: 'instagram', accountId: 'acct', latestTakenAt: 100 })

    const storage = {
      get: async () => ({ accountLabels: { 'instagram:acct': 'alice' }, ignoredUsers: ['instagram:acct:bob'] }),
    } as Pick<typeof chrome.storage.local, 'get'>

    const report = await buildStorageUsageReport(db, storage)

    expect(report).toMatchObject({ snapshots: 1, bufferRows: 1, accounts: 1 })
    expect(report.snapshotBytes).toBeGreaterThan(0)
    expect(report.bufferBytes).toBeGreaterThan(0)
    expect(report.localBytes).toBeGreaterThan(0)
    expect(report.totalBytes).toBe(report.snapshotBytes + report.bufferBytes + report.localBytes)
  })

  it('keeps only the latest snapshots per account', async () => {
    await db.snapshots.bulkAdd([
      { platform: 'instagram', accountId: 'acct', takenAt: 100, followers: [user], following: [] },
      { platform: 'instagram', accountId: 'acct', takenAt: 200, followers: [user], following: [] },
      { platform: 'instagram', accountId: 'acct', takenAt: 300, followers: [user], following: [] },
      { platform: 'github', accountId: 'octo', takenAt: 150, followers: [], following: [user] },
      { platform: 'github', accountId: 'octo', takenAt: 250, followers: [], following: [user] },
    ])

    const result = await applySnapshotRetention(2)
    const snapshots = await db.snapshots.orderBy('takenAt').toArray()

    expect(result).toEqual({ deletedSnapshots: 1, keptSnapshots: 4 })
    expect(snapshots.map((snapshot) => `${snapshot.platform}:${snapshot.accountId}:${snapshot.takenAt}`)).toEqual([
      'github:octo:150',
      'instagram:acct:200',
      'github:octo:250',
      'instagram:acct:300',
    ])
    await expect(db.accountSummaries.get(['instagram', 'acct'])).resolves.toMatchObject({ latestTakenAt: 300 })
    await expect(db.accountSummaries.get(['github', 'octo'])).resolves.toMatchObject({ latestTakenAt: 250 })
  })
})
