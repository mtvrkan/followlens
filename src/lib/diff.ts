import type { SocialUser, Snapshot, SnapshotDiff } from './types'

// Matching is username-first, `id` second — NOT id-first. The same person can
// legitimately arrive with two different `id` values for one account, because
// a single scan mixes data sources that use different identity spaces:
// Instagram's DOM scrape sets `id` to the username while its network/self-fetch
// path sets it to the numeric `pk`; GitHub's DOM scrape uses the login while its
// API path uses the numeric id. Keying on `id` first therefore made the same
// follower look like a different person whenever consecutive scans (or the two
// directions of one scan) happened to be collected via different paths —
// surfacing as everyone reported lost + new, or as a whole "not following back"
// list of false positives. The username is stable across every source and is
// already what the scan buffer dedupes on (see addBufferUsers), so it leads
// here; `id` stays as the secondary bridge that still catches a genuine handle
// rename, on any platform whose ids are stable, instead of reporting it as
// one lost + one new user.
function usernameKey(user: SocialUser): string {
  return user.username.trim().toLowerCase()
}

function idKey(user: SocialUser): string | null {
  const id = user.id?.trim().toLowerCase()
  return id ? id : null
}

/**
 * Membership lookup for one side of a comparison (a snapshot's followers or
 * following list). Deduped by username — the same normalization the buffer's
 * primary key uses — with a parallel id index consulted only when the username
 * finds nothing.
 */
class UserIndex {
  private readonly byUsername = new Map<string, SocialUser>()
  private readonly byId = new Map<string, SocialUser>()

  constructor(users: SocialUser[]) {
    for (const user of users) {
      this.byUsername.set(usernameKey(user), user)
      const id = idKey(user)
      if (id) this.byId.set(id, user)
    }
  }

  has(user: SocialUser): boolean {
    if (this.byUsername.has(usernameKey(user))) return true
    const id = idKey(user)
    return id ? this.byId.has(id) : false
  }

  users(): SocialUser[] {
    return [...this.byUsername.values()]
  }
}

export function diffSnapshots(previous: Snapshot | undefined, current: Snapshot): SnapshotDiff {
  const prevFollowers = new UserIndex(previous?.followers ?? [])
  const currFollowers = new UserIndex(current.followers)
  const prevFollowing = new UserIndex(previous?.following ?? [])
  const currFollowing = new UserIndex(current.following)

  const newFollowers = currFollowers.users().filter((u) => !prevFollowers.has(u))
  const lostFollowers = prevFollowers.users().filter((u) => !currFollowers.has(u))
  const newFollowing = currFollowing.users().filter((u) => !prevFollowing.has(u))
  const lostFollowing = prevFollowing.users().filter((u) => !currFollowing.has(u))
  const notFollowingBack = currFollowing.users().filter((u) => !currFollowers.has(u))

  // Deduped via the index rather than passed straight through from
  // `current`, so the full lists key on the same identity the categories do.
  return {
    newFollowers,
    lostFollowers,
    newFollowing,
    lostFollowing,
    notFollowingBack,
    allFollowers: currFollowers.users(),
    allFollowing: currFollowing.users(),
  }
}
