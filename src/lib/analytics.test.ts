import { describe, expect, it } from 'vitest'
import { buildAccountHealth, buildGrowthSeries, filterSnapshotsByRange } from './analytics'
import type { Snapshot } from './types'

function user(username: string) {
  return { id: username, username, displayName: '', avatarUrl: '', isVerified: false, isPrivate: false }
}

function snap(id: number, takenAt: number, followerCount: number, followingCount: number): Snapshot {
  return {
    id,
    platform: 'instagram',
    accountId: 'acc',
    takenAt,
    followers: Array.from({ length: followerCount }, (_, i) => user(`f${i}`)),
    following: Array.from({ length: followingCount }, (_, i) => user(`g${i}`)),
  }
}

describe('filterSnapshotsByRange', () => {
  const all = [snap(1, 1000, 10, 5), snap(2, 2000, 12, 5), snap(3, 3000, 11, 6)]

  it('includes snapshots within the inclusive range', () => {
    expect(filterSnapshotsByRange(all, 1000, 2000).map((s) => s.id)).toEqual([1, 2])
  })

  it('excludes snapshots outside the range', () => {
    expect(filterSnapshotsByRange(all, 1500, 2500).map((s) => s.id)).toEqual([2])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterSnapshotsByRange(all, 5000, 6000)).toEqual([])
  })
})

describe('buildGrowthSeries', () => {
  const all = [snap(1, 1000, 10, 5), snap(2, 2000, 12, 5), snap(3, 3000, 11, 6)]

  it('computes deltas against the previous snapshot in the full history, not just the range', () => {
    const range = filterSnapshotsByRange(all, 2000, 3000)
    const series = buildGrowthSeries(all, range)
    expect(series).toEqual([
      { takenAt: 2000, followers: 12, following: 5, followersDelta: 2, followingDelta: 0 },
      { takenAt: 3000, followers: 11, following: 6, followersDelta: -1, followingDelta: 1 },
    ])
  })

  it('gives the very first snapshot in history a zero delta', () => {
    const series = buildGrowthSeries(all, [all[0]])
    expect(series[0].followersDelta).toBe(0)
    expect(series[0].followingDelta).toBe(0)
  })

  it('returns an empty series for an empty range', () => {
    expect(buildGrowthSeries(all, [])).toEqual([])
  })
})

describe('buildAccountHealth', () => {
  it('summarizes latest counts, ratio and 7/30-day follower changes', () => {
    const day = 24 * 60 * 60 * 1000
    const all = [
      snap(1, 0, 100, 50),
      snap(2, 10 * day, 110, 55),
      snap(3, 31 * day, 130, 65),
    ]

    expect(buildAccountHealth(all)).toMatchObject({
      latestFollowers: 130,
      latestFollowing: 65,
      followingRatio: 0.5,
      net7d: 20,
      net30d: 30,
      unusualLoss: false,
      unusualGain: true,
    })
  })

  it('returns null without snapshots', () => {
    expect(buildAccountHealth([])).toBeNull()
  })
})
