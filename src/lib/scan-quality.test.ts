import { describe, expect, it } from 'vitest'
import { assessScanQuality } from './scan-quality'
import type { Snapshot } from './types'

function users(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    username: `user${i}`,
    displayName: `User ${i}`,
    avatarUrl: '',
    isVerified: false,
    isPrivate: false,
  }))
}

const previous: Pick<Snapshot, 'followers' | 'following'> = {
  followers: users(100),
  following: users(80),
}

describe('assessScanQuality', () => {
  it('does not show a score before anything is collected', () => {
    expect(assessScanQuality({ followers: 0, following: 0, previous, collecting: false, looksComplete: false })).toBeNull()
  })

  it('marks one-sided scans as risky', () => {
    expect(assessScanQuality({ followers: 10, following: 0, previous: null, collecting: false, looksComplete: false })).toEqual({
      level: 'risky',
      reason: 'missing-following',
    })
    expect(assessScanQuality({ followers: 0, following: 10, previous: null, collecting: false, looksComplete: false })).toEqual({
      level: 'risky',
      reason: 'missing-followers',
    })
  })

  it('marks sharp drops from the previous scan as risky', () => {
    expect(assessScanQuality({ followers: 40, following: 80, previous, collecting: false, looksComplete: true })).toEqual({
      level: 'risky',
      reason: 'sharp-drop',
    })
  })

  it('marks moderate drops or unfinished collection as partial', () => {
    expect(assessScanQuality({ followers: 75, following: 80, previous, collecting: false, looksComplete: true })).toEqual({
      level: 'partial',
      reason: 'moderate-drop',
    })
    expect(assessScanQuality({ followers: 100, following: 80, previous, collecting: true, looksComplete: false })).toEqual({
      level: 'partial',
      reason: 'still-collecting',
    })
  })

  it('marks stable complete scans as good', () => {
    expect(assessScanQuality({ followers: 100, following: 80, previous, collecting: false, looksComplete: true })).toEqual({
      level: 'good',
      reason: 'complete',
    })
  })

  it('marks a scan short of the profile\'s own stated total as partial, even once self-fetch looks done', () => {
    expect(
      assessScanQuality({
        followers: 224,
        following: 280,
        previous: null,
        expectedFollowers: 236,
        expectedFollowing: 280,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'partial', reason: 'below-expected', gap: { collected: 224, expected: 236 } })
  })

  // Still "good" — self-fetch has already retried until it stopped making
  // progress, and the remainder is most likely accounts the platform will not
  // enumerate — but no longer reported as "complete". Saying complete beside a
  // count the user can see is lower than the profile's own is a claim the
  // data contradicts on screen (reported live: 68 collected, profile said 69).
  it('stays good for a small gap but names it instead of claiming completeness', () => {
    expect(
      assessScanQuality({
        followers: 235,
        following: 280,
        previous: null,
        expectedFollowers: 236,
        expectedFollowing: 280,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'good', reason: 'complete-with-gap', gap: { collected: 235, expected: 236 } })
  })

  it('names the gap for the single-account shortfall that prompted this', () => {
    expect(
      assessScanQuality({
        followers: 68,
        following: 73,
        previous: null,
        expectedFollowers: 69,
        expectedFollowing: 73,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'good', reason: 'complete-with-gap', gap: { collected: 68, expected: 69 } })
  })

  // Followers drive "not following back", so that is the count worth naming
  // when both directions came up short.
  it('reports the followers gap first when both directions are short', () => {
    expect(
      assessScanQuality({
        followers: 68,
        following: 70,
        previous: null,
        expectedFollowers: 69,
        expectedFollowing: 73,
        collecting: false,
        looksComplete: true,
      })?.gap,
    ).toEqual({ collected: 68, expected: 69 })
  })

  it('reports a following-only shortfall', () => {
    expect(
      assessScanQuality({
        followers: 69,
        following: 72,
        previous: null,
        expectedFollowers: 69,
        expectedFollowing: 73,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'good', reason: 'complete-with-gap', gap: { collected: 72, expected: 73 } })
  })

  it('reports plain completeness only when both directions actually reached the stated totals', () => {
    expect(
      assessScanQuality({
        followers: 69,
        following: 73,
        previous: null,
        expectedFollowers: 69,
        expectedFollowing: 73,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'good', reason: 'complete' })
  })

  // Collecting more than the profile states happens (the header stat lags
  // behind); it is not a shortfall and must not be reported as one.
  it('does not treat overshooting the stated total as a gap', () => {
    expect(
      assessScanQuality({
        followers: 71,
        following: 73,
        previous: null,
        expectedFollowers: 69,
        expectedFollowing: 73,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'good', reason: 'complete' })
  })

  it('ignores a missing expected count (no profile stat seen this scan)', () => {
    expect(
      assessScanQuality({
        followers: 100,
        following: 80,
        previous: null,
        expectedFollowers: null,
        expectedFollowing: null,
        collecting: false,
        looksComplete: true,
      }),
    ).toEqual({ level: 'good', reason: 'complete' })
  })
})
