import type { Snapshot } from './types'

export type ScanQualityLevel = 'good' | 'partial' | 'risky'
export type ScanQualityReason =
  | 'missing-followers'
  | 'missing-following'
  | 'sharp-drop'
  | 'moderate-drop'
  | 'below-expected'
  | 'still-collecting'
  | 'not-stable'
  | 'complete-with-gap'
  | 'complete'

/** The two numbers behind a shortfall verdict, so the UI can name them instead of hinting. */
export interface ScanGap {
  collected: number
  expected: number
}

export interface ScanQuality {
  level: ScanQualityLevel
  reason: ScanQualityReason
  /**
   * Set whenever the verdict is about collecting fewer accounts than the
   * platform itself states. The popup shows both numbers, and treats its
   * presence as "do not claim the list is fully loaded" — a scan visibly
   * short of the profile's own count must not also be told it is complete.
   */
  gap?: ScanGap
}

interface ScanQualityInput {
  followers: number
  following: number
  previous?: Pick<Snapshot, 'followers' | 'following'> | null
  /** The platform's own live-read stated total per direction (see `PlatformAdapter.expectedCount`), when one was seen this scan. */
  expectedFollowers?: number | null
  expectedFollowing?: number | null
  collecting: boolean
  looksComplete: boolean
}

const SHARP_DROP_RATIO = 0.5
const MODERATE_DROP_RATIO = 0.8
// Floor below which normal day-to-day fluctuation (or an unset/abbreviated
// expected count) could easily cross a ratio threshold on its own — shared by
// the previous-snapshot and expected-count comparisons below.
const MIN_PREVIOUS_SIZE = 10

// Instagram's own pagination can land short of its own profile-header stat
// even once has_more says done (see injected-script.ts) — confirmed live: a
// scan that finished self-fetch clean still missed real followers, so a
// "not following back" read off it had a false positive. A few accounts of
// gap is within that documented, largely unrecoverable noise floor (self-fetch
// already retries until it stops making progress — see
// collectSelfFetchDirectionWithRetries); this only flags a gap wide
// enough that the user should distrust "not following back" results, not
// every single-digit shortfall.
const EXPECTED_GAP_RATIO = 0.97

function droppedBelow(current: number, previous: number, ratio: number): boolean {
  return previous >= MIN_PREVIOUS_SIZE && current < previous * ratio
}

export function assessScanQuality(input: ScanQualityInput): ScanQuality | null {
  const { followers, following, previous, expectedFollowers, expectedFollowing, collecting, looksComplete } = input
  const total = followers + following
  if (total === 0) return null

  if (followers === 0) return { level: 'risky', reason: 'missing-followers' }
  if (following === 0) return { level: 'risky', reason: 'missing-following' }

  if (previous) {
    const sharpDrop =
      droppedBelow(followers, previous.followers.length, SHARP_DROP_RATIO) ||
      droppedBelow(following, previous.following.length, SHARP_DROP_RATIO)
    if (sharpDrop) return { level: 'risky', reason: 'sharp-drop' }

    const moderateDrop =
      droppedBelow(followers, previous.followers.length, MODERATE_DROP_RATIO) ||
      droppedBelow(following, previous.following.length, MODERATE_DROP_RATIO)
    if (moderateDrop) return { level: 'partial', reason: 'moderate-drop' }
  }

  if (collecting) return { level: 'partial', reason: 'still-collecting' }
  if (!looksComplete) return { level: 'partial', reason: 'not-stable' }

  const belowExpected =
    droppedBelow(followers, expectedFollowers ?? 0, EXPECTED_GAP_RATIO) ||
    droppedBelow(following, expectedFollowing ?? 0, EXPECTED_GAP_RATIO)
  if (belowExpected) {
    return { level: 'partial', reason: 'below-expected', gap: shortfall(followers, following, expectedFollowers, expectedFollowing) }
  }

  // Inside the noise floor above, but still not the number the user can read
  // off the profile. The verdict stays "good" — self-fetch has already
  // retried until it stopped making progress, and the remainder is most
  // likely accounts the platform will not enumerate at all — but saying
  // "complete" here was a claim the data contradicted on screen: the popup
  // showed 68 collected beside a profile stating 69 and called both lists
  // complete anyway. Naming the gap costs nothing and is simply true.
  const gap = shortfall(followers, following, expectedFollowers, expectedFollowing)
  if (gap) return { level: 'good', reason: 'complete-with-gap', gap }

  return { level: 'good', reason: 'complete' }
}

/**
 * The first direction that came up short of the platform's own stated total,
 * as a pair of numbers to show. Followers first: it is the count that drives
 * "not following back", so it is the one worth naming when both are short.
 */
function shortfall(
  followers: number,
  following: number,
  expectedFollowers?: number | null,
  expectedFollowing?: number | null,
): ScanGap | undefined {
  if (expectedFollowers != null && followers < expectedFollowers) return { collected: followers, expected: expectedFollowers }
  if (expectedFollowing != null && following < expectedFollowing) return { collected: following, expected: expectedFollowing }
  return undefined
}
