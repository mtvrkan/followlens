import { describe, expect, it } from 'vitest'
import {
  buildTaggedRows,
  countActiveAttributeFilters,
  countByAttribute,
  filterByAttributes,
  NO_ATTRIBUTE_FILTERS,
  type FilterKey,
  type Row,
} from './rows'
import type { SnapshotDiff } from './types'

function user(username: string, displayName = username) {
  return { id: username, username, displayName, avatarUrl: '', isVerified: false, isPrivate: false }
}

function filtersSetTo(value: boolean, overrides: Partial<Record<FilterKey, boolean>> = {}): Record<FilterKey, boolean> {
  return {
    allFollowers: value,
    allFollowing: value,
    notFollowingBack: value,
    newFollowers: value,
    lostFollowers: value,
    newFollowing: value,
    lostFollowing: value,
    ...overrides,
  }
}

const ALL_FILTERS = filtersSetTo(true)
const NO_FILTERS = filtersSetTo(false)
/** The change categories only — what the sidebar shows before anyone ticks a full-list box. */
const CHANGE_FILTERS = filtersSetTo(true, { allFollowers: false, allFollowing: false })

function diff(overrides: Partial<SnapshotDiff> = {}): SnapshotDiff {
  return {
    newFollowers: [],
    lostFollowers: [],
    newFollowing: [],
    lostFollowing: [],
    notFollowingBack: [],
    allFollowers: [],
    allFollowing: [],
    ...overrides,
  }
}

describe('buildTaggedRows', () => {
  it('returns an empty array for a null diff', () => {
    expect(buildTaggedRows(null, ALL_FILTERS, '')).toEqual([])
  })

  it('tags each category correctly', () => {
    const rows = buildTaggedRows(
      diff({ newFollowers: [user('alice')], lostFollowers: [user('bob')], notFollowingBack: [user('carol')] }),
      ALL_FILTERS,
      '',
    )
    expect(rows.find((r) => r.username === 'alice')?.tags).toEqual(['newFollowers'])
    expect(rows.find((r) => r.username === 'bob')?.tags).toEqual(['lostFollowers'])
    expect(rows.find((r) => r.username === 'carol')?.tags).toEqual(['notFollowingBack'])
  })

  it('gives a user appearing in multiple categories all of their tags, and only one row', () => {
    const rows = buildTaggedRows(
      diff({ newFollowers: [user('alice')], notFollowingBack: [user('alice')] }),
      ALL_FILTERS,
      '',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].tags).toEqual(expect.arrayContaining(['newFollowers', 'notFollowingBack']))
  })

  it('shows everything when no filters are active (no filters = show all)', () => {
    const rows = buildTaggedRows(diff({ newFollowers: [user('alice')], lostFollowers: [user('bob')] }), NO_FILTERS, '')
    expect(rows.map((r) => r.username).sort()).toEqual(['alice', 'bob'])
  })

  it('only shows rows matching an active filter', () => {
    const rows = buildTaggedRows(
      diff({ newFollowers: [user('alice')], lostFollowers: [user('bob')] }),
      filtersSetTo(false, { newFollowers: true }),
      '',
    )
    expect(rows.map((r) => r.username)).toEqual(['alice'])
  })

  it('filters by case-insensitive username search', () => {
    const rows = buildTaggedRows(diff({ newFollowers: [user('Alice'), user('Bob')] }), ALL_FILTERS, 'ali')
    expect(rows.map((r) => r.username)).toEqual(['Alice'])
  })

  it('combines search and filter (both must match)', () => {
    const rows = buildTaggedRows(
      diff({ newFollowers: [user('alice')], lostFollowers: [user('albert')] }),
      filtersSetTo(false, { newFollowers: true }),
      'al',
    )
    expect(rows.map((r) => r.username)).toEqual(['alice'])
  })

  it('hides ignored not-following-back rows by default', () => {
    const rows = buildTaggedRows(
      diff({ notFollowingBack: [user('alice'), user('bob')] }),
      ALL_FILTERS,
      '',
      new Set(['alice']),
    )
    expect(rows.map((r) => r.username)).toEqual(['bob'])
  })

  it('keeps ignored rows visible when they also match another category', () => {
    const rows = buildTaggedRows(
      diff({ notFollowingBack: [user('alice')], newFollowers: [user('alice')] }),
      ALL_FILTERS,
      '',
      new Set(['alice']),
    )
    expect(rows.map((r) => r.username)).toEqual(['alice'])
    expect(rows[0].ignored).toBe(true)
  })

  it('can show ignored rows for review', () => {
    const rows = buildTaggedRows(
      diff({ notFollowingBack: [user('alice')] }),
      ALL_FILTERS,
      '',
      new Set(['alice']),
      true,
    )
    expect(rows.map((r) => r.username)).toEqual(['alice'])
    expect(rows[0].ignored).toBe(true)
  })

  it('surfaces the whole follower list on a first scan, where every change category is empty', () => {
    const rows = buildTaggedRows(
      diff({ allFollowers: [user('alice'), user('bob')], allFollowing: [user('alice')] }),
      filtersSetTo(false, { allFollowers: true }),
      '',
    )
    expect(rows.map((r) => r.username).sort()).toEqual(['alice', 'bob'])
  })

  it('tags a mutual follow with both full-list categories', () => {
    const rows = buildTaggedRows(diff({ allFollowers: [user('alice')], allFollowing: [user('alice')] }), ALL_FILTERS, '')
    expect(rows).toHaveLength(1)
    expect(rows[0].tags).toEqual(expect.arrayContaining(['allFollowers', 'allFollowing']))
  })

  it('falls back to the change categories — not the full lists — when no box is ticked', () => {
    const rows = buildTaggedRows(
      diff({ newFollowers: [user('alice')], allFollowers: [user('alice'), user('bob')] }),
      NO_FILTERS,
      '',
    )
    expect(rows.map((r) => r.username)).toEqual(['alice'])
  })

  it('keeps an ignored account in the full-following list — ignoring only silences the not-following-back nag', () => {
    const withoutFullLists = buildTaggedRows(
      diff({ notFollowingBack: [user('alice')], allFollowing: [user('alice')] }),
      CHANGE_FILTERS,
      '',
      new Set(['alice']),
    )
    const withFullList = buildTaggedRows(
      diff({ notFollowingBack: [user('alice')], allFollowing: [user('alice')] }),
      filtersSetTo(false, { allFollowing: true }),
      '',
      new Set(['alice']),
    )
    expect(withoutFullLists).toEqual([])
    expect(withFullList.map((r) => r.username)).toEqual(['alice'])
  })
})

function attrRow(username: string, isVerified: boolean, isPrivate: boolean): Row {
  return {
    id: username,
    username,
    displayName: username,
    avatarUrl: '',
    isVerified,
    isPrivate,
    tags: ['notFollowingBack'],
    ignored: false,
  }
}

const PLAIN = attrRow('plain', false, false)
const VERIFIED = attrRow('verified', true, false)
const PRIVATE = attrRow('private', false, true)
const BOTH = attrRow('both', true, true)
const ALL_ROWS = [PLAIN, VERIFIED, PRIVATE, BOTH]

describe('filterByAttributes', () => {
  it('returns everything when neither attribute is constrained', () => {
    expect(filterByAttributes(ALL_ROWS, NO_ATTRIBUTE_FILTERS)).toEqual(ALL_ROWS)
  })

  it('keeps only verified accounts', () => {
    const rows = filterByAttributes(ALL_ROWS, { verified: 'only', private: 'any' })

    expect(rows.map((row) => row.username)).toEqual(['verified', 'both'])
  })

  // The half a boolean toggle could never express.
  it('excludes verified accounts', () => {
    const rows = filterByAttributes(ALL_ROWS, { verified: 'exclude', private: 'any' })

    expect(rows.map((row) => row.username)).toEqual(['plain', 'private'])
  })

  it('keeps only private accounts', () => {
    const rows = filterByAttributes(ALL_ROWS, { verified: 'any', private: 'only' })

    expect(rows.map((row) => row.username)).toEqual(['private', 'both'])
  })

  it('excludes private accounts', () => {
    const rows = filterByAttributes(ALL_ROWS, { verified: 'any', private: 'exclude' })

    expect(rows.map((row) => row.username)).toEqual(['plain', 'verified'])
  })

  // Two constrained attributes narrow, they do not widen — the same reading as
  // two active category filters.
  it('requires both attributes when both are set to only', () => {
    const rows = filterByAttributes(ALL_ROWS, { verified: 'only', private: 'only' })

    expect(rows.map((row) => row.username)).toEqual(['both'])
  })

  it('combines only with exclude across the two attributes', () => {
    const rows = filterByAttributes(ALL_ROWS, { verified: 'only', private: 'exclude' })

    expect(rows.map((row) => row.username)).toEqual(['verified'])
  })

  it('returns nothing when no row satisfies the constraint', () => {
    expect(filterByAttributes([PLAIN], { verified: 'only', private: 'any' })).toEqual([])
  })

  it('handles an empty list', () => {
    expect(filterByAttributes([], { verified: 'only', private: 'exclude' })).toEqual([])
  })
})

describe('countActiveAttributeFilters', () => {
  it('counts nothing for the default filters', () => {
    expect(countActiveAttributeFilters(NO_ATTRIBUTE_FILTERS)).toBe(0)
  })

  it('counts each constrained attribute, whichever direction it constrains', () => {
    expect(countActiveAttributeFilters({ verified: 'only', private: 'any' })).toBe(1)
    expect(countActiveAttributeFilters({ verified: 'any', private: 'exclude' })).toBe(1)
    expect(countActiveAttributeFilters({ verified: 'exclude', private: 'only' })).toBe(2)
  })
})

describe('countByAttribute', () => {
  it('counts each attribute independently, including rows that have both', () => {
    expect(countByAttribute(ALL_ROWS)).toEqual({ verified: 2, private: 2 })
  })

  it('reports zeroes for a list with neither attribute — what hides the toggles', () => {
    expect(countByAttribute([PLAIN])).toEqual({ verified: 0, private: 0 })
  })

  it('reports zeroes for an empty list', () => {
    expect(countByAttribute([])).toEqual({ verified: 0, private: 0 })
  })
})
