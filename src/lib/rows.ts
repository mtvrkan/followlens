import type { SnapshotDiff, SocialUser } from './types'

export type FilterKey =
  | 'allFollowers'
  | 'allFollowing'
  | 'notFollowingBack'
  | 'newFollowers'
  | 'lostFollowers'
  | 'newFollowing'
  | 'lostFollowing'

/** The categories that describe a change between two scans, as opposed to the full-list ones. */
const CHANGE_TAGS: FilterKey[] = ['notFollowingBack', 'newFollowers', 'lostFollowers', 'newFollowing', 'lostFollowing']

/** Order the tags are assigned and rows are collected in — the full lists last, so a row's tag list still leads with what changed. */
const TAG_ORDER: FilterKey[] = [...CHANGE_TAGS, 'allFollowers', 'allFollowing']

export interface Row extends SocialUser {
  tags: FilterKey[]
  ignored: boolean
}

/**
 * Narrowing by what kind of account a row is, as opposed to which change
 * category it fell into (that is `FilterKey`). Kept separate from
 * `buildTaggedRows` because these are properties of the person, not of the
 * diff — composing them afterwards keeps both functions single-purpose and lets
 * the caller decide which lists they apply to.
 */
/**
 * Three-way per attribute, not a boolean: "only verified" and "everyone except
 * verified" are both things people want, and a checkbox can only express the
 * first. `any` is no narrowing at all (the default) rather than "hide these".
 */
export type AttributeMatch = 'any' | 'only' | 'exclude'

export interface AttributeFilters {
  verified: AttributeMatch
  private: AttributeMatch
}

export const NO_ATTRIBUTE_FILTERS: AttributeFilters = { verified: 'any', private: 'any' }

function matches(value: boolean, match: AttributeMatch): boolean {
  if (match === 'only') return value
  if (match === 'exclude') return !value
  return true
}

/**
 * The two attributes combine (AND), the same way two active category filters
 * read: "only verified" + "except private" leaves verified public accounts.
 *
 * Note the data limit this inherits: a platform path that never reports these
 * attributes (Instagram's DOM scrape, GitHub) leaves every row unverified and
 * public, so `only` finds nothing there. That is why the filter panel shows each
 * attribute's count and the toolbar can point at what a filter would leave.
 */
export function filterByAttributes(rows: Row[], { verified, private: isPrivate }: AttributeFilters): Row[] {
  if (verified === 'any' && isPrivate === 'any') return rows
  return rows.filter((row) => matches(row.isVerified, verified) && matches(row.isPrivate, isPrivate))
}

/** How many attributes are currently narrowing the list — drives the count badge on the filter button. */
export function countActiveAttributeFilters(filters: AttributeFilters): number {
  return Number(filters.verified !== 'any') + Number(filters.private !== 'any')
}

export function countByAttribute(rows: Row[]): { verified: number; private: number } {
  return {
    verified: rows.filter((row) => row.isVerified).length,
    private: rows.filter((row) => row.isPrivate).length,
  }
}

/**
 * Tags every user in a diff by which categories they fall into (a user can
 * land in more than one, e.g. a new follower who also doesn't follow back),
 * dedupes by username, then applies the active filters and a username
 * search. Shared between the main follower-list view and the
 * arbitrary-two-snapshot comparison view so both filter identically.
 */
export function buildTaggedRows(
  diff: SnapshotDiff | null,
  filters: Record<FilterKey, boolean>,
  search: string,
  ignoredUsernames: ReadonlySet<string> = new Set(),
  showIgnored = false,
): Row[] {
  if (!diff) return []

  // Keyed case-insensitively (same normalization as diff.ts and the scan
  // buffer): followers and following are collected as two separate lists, so
  // the same person can legitimately arrive as "Alice" in one and "alice" in
  // the other — keying on the raw username split that person into two rows,
  // each carrying only half of their tags.
  const usernameKey = (user: SocialUser) => user.username.toLowerCase()
  const tagsByUsername = new Map<string, FilterKey[]>()
  const addTag = (user: SocialUser, tag: FilterKey) => {
    tagsByUsername.set(usernameKey(user), [...(tagsByUsername.get(usernameKey(user)) ?? []), tag])
  }

  for (const tag of TAG_ORDER) diff[tag].forEach((u) => addTag(u, tag))

  const seen = new Set<string>()
  const rows: Row[] = []
  for (const user of TAG_ORDER.flatMap((tag) => diff[tag])) {
    if (seen.has(usernameKey(user))) continue
    seen.add(usernameKey(user))
    const tags = tagsByUsername.get(usernameKey(user)) ?? []
    const ignored = tags.includes('notFollowingBack') && ignoredUsernames.has(usernameKey(user))
    rows.push({ ...user, tags, ignored })
  }

  const activeFilters = (Object.keys(filters) as FilterKey[]).filter((key) => filters[key])
  const searchLower = search.toLowerCase()

  return rows.filter((row) => {
    const matchesSearch = row.username.toLowerCase().includes(searchLower)
    // Ignoring somebody only silences the "doesn't follow you back" nag — it is
    // not a block. They stay visible under `allFollowing`, because they are in
    // fact still someone you follow.
    const tags = row.ignored && !showIgnored ? row.tags.filter((tag) => tag !== 'notFollowingBack') : row.tags
    // With no box ticked the list falls back to the change categories, not to
    // everyone: `allFollowers`/`allFollowing` tag the entire account, so
    // treating an empty filter set as "no narrowing" would turn clearing the
    // filters into dumping the full follower list.
    const matchesFilter = tags.some((tag) => (activeFilters.length === 0 ? CHANGE_TAGS.includes(tag) : activeFilters.includes(tag)))
    return matchesSearch && matchesFilter
  })
}
