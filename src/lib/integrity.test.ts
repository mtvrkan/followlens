import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { buildDataIntegrityReport, hasIntegrityIssues } from './integrity'

const user = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: '',
  isVerified: false,
  isPrivate: false,
}

describe('data integrity report', () => {
  beforeEach(async () => {
    await db.snapshots.clear()
    await db.accountSummaries.clear()
    await db.bufferUsers.clear()
  })

  it('reports a clean database', async () => {
    await db.snapshots.add({
      platform: 'instagram',
      accountId: 'acct',
      takenAt: 100,
      followers: [user],
      following: [user],
    })
    await db.accountSummaries.put({ platform: 'instagram', accountId: 'acct', latestTakenAt: 100 })

    const report = await buildDataIntegrityReport()

    expect(report).toMatchObject({
      snapshots: 1,
      duplicateSnapshots: 0,
      invalidSnapshots: 0,
      staleAccountSummaries: 0,
      missingAccountSummaries: 0,
      orphanedBufferRows: 0,
    })
    expect(hasIntegrityIssues(report)).toBe(false)
  })

  it('treats a snapshot saved before isPrivate existed as valid, not corrupt', async () => {
    const userWithoutIsPrivate = { id: '1', username: 'alice', displayName: 'Alice', avatarUrl: '', isVerified: false }
    await db.snapshots.add({
      platform: 'instagram',
      accountId: 'acct',
      takenAt: 100,
      followers: [userWithoutIsPrivate as typeof user],
      following: [],
    })

    const report = await buildDataIntegrityReport()

    expect(report.invalidSnapshots).toBe(0)
  })

  it('counts duplicate snapshots and account-summary issues', async () => {
    await db.snapshots.bulkAdd([
      { platform: 'instagram', accountId: 'acct', takenAt: 100, followers: [user], following: [] },
      { platform: 'instagram', accountId: 'acct', takenAt: 100, followers: [user], following: [] },
    ])
    await db.accountSummaries.put({ platform: 'github', accountId: 'stale', latestTakenAt: 50 })
    await db.bufferUsers.put({ platform: 'github', accountId: 'buffer-only', direction: 'followers', username: 'bob', user })

    const report = await buildDataIntegrityReport()

    expect(report).toMatchObject({
      snapshots: 2,
      duplicateSnapshots: 1,
      staleAccountSummaries: 1,
      missingAccountSummaries: 1,
      orphanedBufferRows: 1,
    })
    expect(hasIntegrityIssues(report)).toBe(true)
  })
})
