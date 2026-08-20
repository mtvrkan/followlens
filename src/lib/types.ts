import type { PlatformId, SocialUser } from '../platforms/types'

export type { PlatformId, SocialUser } from '../platforms/types'

export interface Snapshot {
  id?: number
  platform: PlatformId
  accountId: string
  accountUsername?: string
  takenAt: number
  followers: SocialUser[]
  following: SocialUser[]
}

export interface SnapshotDiff {
  newFollowers: SocialUser[]
  lostFollowers: SocialUser[]
  newFollowing: SocialUser[]
  lostFollowing: SocialUser[]
  notFollowingBack: SocialUser[]
  /**
   * Not a diff at all — the current snapshot's two lists, carried here so the
   * results view can offer "everyone who follows me" / "everyone I follow"
   * alongside the change categories. Without them a freshly scanned account
   * has almost nothing to show: every change category is empty until there is
   * a second scan to compare against, yet the data for the full lists is
   * already sitting in the snapshot.
   */
  allFollowers: SocialUser[]
  allFollowing: SocialUser[]
}

export interface SnapshotSizeWarning {
  followers: number
  following: number
  previousFollowers: number
  previousFollowing: number
  /**
   * The platform's own stated total for each direction (e.g. Instagram's
   * "131 takipçi" profile stat), when the adapter could read one. Present
   * even on a first-ever scan (no `previous` snapshot to compare against),
   * which is otherwise unvalidated.
   */
  expectedFollowers?: number
  expectedFollowing?: number
}

/**
 * A scan that collected far fewer people than the previous one almost
 * always means the list wasn't fully scrolled, not that everyone actually
 * unfollowed — saving it as-is would silently blow away the real history.
 * 'needs-confirmation' asks the user to confirm before that happens.
 */
export type SaveSnapshotResult =
  | { status: 'no-data' }
  | { status: 'needs-confirmation'; warning: SnapshotSizeWarning }
  | { status: 'saved'; diff: SnapshotDiff }
