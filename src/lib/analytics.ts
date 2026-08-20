import type { Snapshot } from './types'

export interface GrowthPoint {
  takenAt: number
  followers: number
  following: number
  followersDelta: number
  followingDelta: number
}

export interface AccountHealth {
  latestFollowers: number
  latestFollowing: number
  followingRatio: number | null
  net7d: number
  net30d: number
  unusualLoss: boolean
  unusualGain: boolean
}

/** Snapshots taken within [fromMs, toMs], inclusive. Assumes `snapshots` is already sorted oldest→newest. */
export function filterSnapshotsByRange(snapshots: Snapshot[], fromMs: number, toMs: number): Snapshot[] {
  return snapshots.filter((s) => s.takenAt >= fromMs && s.takenAt <= toMs)
}

/**
 * One point per snapshot in `rangeSnapshots`, with follower/following deltas
 * computed against the previous snapshot in the FULL history (`allSnapshotsSorted`)
 * — not just the previous point within the range — so picking a narrower date
 * range doesn't make the first visible point's delta look like it came from
 * nothing. The very first snapshot ever taken has no prior point, so its delta is 0.
 */
export function buildGrowthSeries(allSnapshotsSorted: Snapshot[], rangeSnapshots: Snapshot[]): GrowthPoint[] {
  const indexById = new Map(allSnapshotsSorted.map((s, i) => [s.id, i]))

  return rangeSnapshots.map((snap) => {
    // `?? 0` here used to silently pretend any lookup miss was "the very
    // first snapshot ever" — same resulting delta (0) as a genuine miss, but
    // for the wrong reason. Checked explicitly instead: both `undefined` (not
    // found) and `0` (genuinely first) correctly fall through to `previous = undefined`.
    const index = indexById.get(snap.id)
    const previous = index !== undefined && index > 0 ? allSnapshotsSorted[index - 1] : undefined

    return {
      takenAt: snap.takenAt,
      followers: snap.followers.length,
      following: snap.following.length,
      followersDelta: snap.followers.length - (previous?.followers.length ?? snap.followers.length),
      followingDelta: snap.following.length - (previous?.following.length ?? snap.following.length),
    }
  })
}

function findBaseline(snapshots: Snapshot[], latestTakenAt: number, windowMs: number): Snapshot | undefined {
  const threshold = latestTakenAt - windowMs
  return [...snapshots].reverse().find((snapshot) => snapshot.takenAt <= threshold) ?? snapshots[0]
}

export function buildAccountHealth(snapshots: Snapshot[]): AccountHealth | null {
  if (snapshots.length === 0) return null
  const latest = snapshots[snapshots.length - 1]
  const baseline7d = findBaseline(snapshots, latest.takenAt, 7 * 24 * 60 * 60 * 1000)
  const baseline30d = findBaseline(snapshots, latest.takenAt, 30 * 24 * 60 * 60 * 1000)
  const net7d = latest.followers.length - (baseline7d?.followers.length ?? latest.followers.length)
  const net30d = latest.followers.length - (baseline30d?.followers.length ?? latest.followers.length)
  const latestDelta = snapshots.length > 1 ? latest.followers.length - snapshots[snapshots.length - 2].followers.length : 0
  const recentDeltas = snapshots.slice(-6, -1).map((snapshot, index, recent) => {
    const previous = index === 0 ? snapshots[snapshots.length - recent.length - 1] : recent[index - 1]
    return previous ? snapshot.followers.length - previous.followers.length : 0
  })
  const averageAbsDelta = recentDeltas.length > 0 ? recentDeltas.reduce((sum, delta) => sum + Math.abs(delta), 0) / recentDeltas.length : 0
  const anomalyThreshold = Math.max(5, averageAbsDelta * 3)

  return {
    latestFollowers: latest.followers.length,
    latestFollowing: latest.following.length,
    followingRatio: latest.followers.length > 0 ? latest.following.length / latest.followers.length : null,
    net7d,
    net30d,
    unusualLoss: latestDelta <= -anomalyThreshold,
    unusualGain: latestDelta >= anomalyThreshold,
  }
}
