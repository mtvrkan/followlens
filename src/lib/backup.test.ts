import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { importBackup, parseBackupJson, type BackupFile } from './backup'

const alice = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: '',
  isVerified: false,
  isPrivate: false,
}

const backup: BackupFile = {
  version: 1,
  exportedAt: '2026-07-07T00:00:00.000Z',
  accountLabels: { 'instagram:acct': 'alice' },
  snapshots: [
    {
      platform: 'instagram',
      accountId: 'acct',
      accountUsername: 'alice',
      takenAt: 1_700_000_000_000,
      followers: [alice],
      following: [],
    },
  ],
}

describe('backup import', () => {
  beforeEach(async () => {
    await db.snapshots.clear()
    await db.accountSummaries.clear()
  })

  // A backup file is user-chosen but still untrusted input, validated on the
  // options page's main thread: without a ceiling, a file claiming an absurd
  // number of snapshots freezes the tab inside the per-snapshot walk with no
  // way out. Rejected up front instead, as an ordinary invalid backup.
  it('rejects a backup claiming more snapshots than any real export holds', () => {
    const oversized = { version: 1, snapshots: new Array(10_001).fill(backup.snapshots[0]) }
    expect(parseBackupJson(JSON.stringify(oversized))).toEqual({ ok: false, error: 'too-large' })
  })

  it('rejects a single snapshot claiming an absurd number of users', () => {
    const oversized = {
      version: 1,
      snapshots: [{ ...backup.snapshots[0], followers: new Array(200_001).fill(alice) }],
    }
    expect(parseBackupJson(JSON.stringify(oversized))).toEqual({ ok: false, error: 'invalid-snapshot' })
  })

  // TikTok and X were removed from the extension. A backup taken while they
  // existed must still restore its Instagram/GitHub history rather than being
  // refused wholesale over scans of a platform that no longer exists.
  it('skips snapshots from removed platforms but keeps the rest of the backup', () => {
    const mixed = {
      version: 1,
      snapshots: [{ ...backup.snapshots[0], platform: 'tiktok' }, backup.snapshots[0]],
    }
    const parsed = parseBackupJson(JSON.stringify(mixed))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.snapshots).toHaveLength(1)
    expect(parsed.value.snapshots[0].platform).toBe('instagram')
  })

  it('still rejects a backup whose supported snapshots are malformed', () => {
    const broken = { version: 1, snapshots: [{ ...backup.snapshots[0], takenAt: 'yesterday' }] }
    expect(parseBackupJson(JSON.stringify(broken))).toEqual({ ok: false, error: 'invalid-snapshot' })
  })

  it('rejects malformed backups', () => {
    expect(parseBackupJson('{')).toEqual({ ok: false, error: 'invalid-json' })
    expect(parseBackupJson(JSON.stringify({ version: 2, snapshots: [] }))).toEqual({ ok: false, error: 'unsupported-version' })
    expect(parseBackupJson(JSON.stringify({ version: 1, snapshots: [{ platform: 'bad' }] }))).toEqual({
      ok: false,
      error: 'invalid-snapshot',
    })
  })

  it('accepts backups saved before isPrivate existed', () => {
    const aliceWithoutIsPrivate = { id: '1', username: 'alice', displayName: 'Alice', avatarUrl: '', isVerified: false }
    const legacyBackup = { ...backup, snapshots: [{ ...backup.snapshots[0], followers: [aliceWithoutIsPrivate] }] }
    const parsed = parseBackupJson(JSON.stringify(legacyBackup))
    expect(parsed.ok).toBe(true)
  })

  it('normalizes valid backup snapshots by dropping exported ids', () => {
    const parsed = parseBackupJson(JSON.stringify({ ...backup, snapshots: [{ ...backup.snapshots[0], id: 123 }] }))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.value.snapshots[0].id).toBeUndefined()
  })

  it('imports snapshots once, restores labels, and rebuilds account summaries', async () => {
    const stored: Record<string, unknown> = { accountLabels: { 'github:octo': 'octo' } }
    const storage = {
      get: async () => ({ accountLabels: stored.accountLabels }),
      set: async (values: Record<string, unknown>) => {
        Object.assign(stored, values)
      },
    } as Pick<typeof chrome.storage.local, 'get' | 'set'>

    const first = await importBackup(backup, { snapshots: db.snapshots, accountSummaries: db.accountSummaries }, storage)
    const second = await importBackup(backup, { snapshots: db.snapshots, accountSummaries: db.accountSummaries }, storage)

    expect(first).toEqual({ importedSnapshots: 1, skippedSnapshots: 0, restoredLabels: 1 })
    expect(second).toEqual({ importedSnapshots: 0, skippedSnapshots: 1, restoredLabels: 1 })
    await expect(db.snapshots.count()).resolves.toBe(1)
    await expect(db.accountSummaries.get(['instagram', 'acct'])).resolves.toMatchObject({
      platform: 'instagram',
      accountId: 'acct',
      latestTakenAt: 1_700_000_000_000,
    })
    expect(stored.accountLabels).toEqual({ 'github:octo': 'octo', 'instagram:acct': 'alice' })
  })
})
