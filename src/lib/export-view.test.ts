import { describe, expect, it } from 'vitest'
import {
  buildExportCells,
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  exportFileStem,
  presetFilters,
  toggleExportColumn,
  type ExportColumn,
} from './export-view'
import type { Row } from './rows'

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: 'alice',
    username: 'alice',
    displayName: 'Alice A',
    avatarUrl: '',
    isVerified: false,
    isPrivate: false,
    tags: ['notFollowingBack'],
    ignored: false,
    ...overrides,
  }
}

const tagLabel = (tag: string) => `label:${tag}`

describe('presetFilters', () => {
  it('isolates the not-following-back category', () => {
    expect(presetFilters('notFollowingBack')).toEqual({
      allFollowers: false,
      allFollowing: false,
      notFollowingBack: true,
      newFollowers: false,
      lostFollowers: false,
      newFollowing: false,
      lostFollowing: false,
    })
  })

  it('isolates unfollowers', () => {
    expect(presetFilters('lostFollowers').lostFollowers).toBe(true)
    expect(presetFilters('lostFollowers').notFollowingBack).toBe(false)
  })

  it('isolates each full list', () => {
    expect(presetFilters('allFollowers').allFollowers).toBe(true)
    expect(presetFilters('allFollowers').allFollowing).toBe(false)
    expect(presetFilters('allFollowing').allFollowing).toBe(true)
    expect(presetFilters('allFollowing').notFollowingBack).toBe(false)
  })
})

describe('toggleExportColumn', () => {
  it('adds a column', () => {
    expect(toggleExportColumn(['username'], 'tags', true)).toEqual(['username', 'tags'])
  })

  it('removes a column', () => {
    expect(toggleExportColumn(['username', 'tags'], 'tags', false)).toEqual(['username'])
  })

  // An export with no columns writes a file of empty lines, which reads as a
  // broken export rather than a chosen one.
  it('refuses to remove the last remaining column', () => {
    expect(toggleExportColumn(['username'], 'username', false)).toEqual(['username'])
  })

  it('normalizes to the canonical column order regardless of tick order', () => {
    expect(toggleExportColumn(['tags', 'username'], 'platform', true)).toEqual(['username', 'tags', 'platform'])
  })

  it('is a no-op when adding a column that is already selected', () => {
    expect(toggleExportColumn(['username', 'tags'], 'tags', true)).toEqual(['username', 'tags'])
  })

  it('defaults to a subset of the available columns', () => {
    expect(DEFAULT_EXPORT_COLUMNS.every((column) => EXPORT_COLUMNS.includes(column))).toBe(true)
  })
})

describe('buildExportCells', () => {
  it('emits one cell per selected column, in column order', () => {
    const columns: ExportColumn[] = ['username', 'displayName', 'tags']

    expect(buildExportCells([row()], columns, 'instagram', tagLabel)).toEqual([['alice', 'Alice A', 'label:notFollowingBack']])
  })

  it('builds the profile URL column from the platform', () => {
    const cells = buildExportCells([row()], ['profileUrl'], 'github', tagLabel)

    expect(cells).toEqual([['https://github.com/alice']])
  })

  it('joins multiple categories with a separator', () => {
    const cells = buildExportCells([row({ tags: ['notFollowingBack', 'newFollowers'] })], ['tags'], 'instagram', tagLabel)

    expect(cells).toEqual([['label:notFollowingBack | label:newFollowers']])
  })

  it('writes the ignored flag as yes/no and the platform as its id', () => {
    const cells = buildExportCells([row({ ignored: true })], ['ignored', 'platform'], 'github', tagLabel)

    expect(cells).toEqual([['yes', 'github']])
  })

  it('leaves the platform cell empty when no platform is selected', () => {
    expect(buildExportCells([row()], ['platform'], null, tagLabel)).toEqual([['']])
  })

  it('returns no rows for an empty selection', () => {
    expect(buildExportCells([], EXPORT_COLUMNS, 'instagram', tagLabel)).toEqual([])
  })
})

describe('exportFileStem', () => {
  it('names the file after the platform, account and preset', () => {
    expect(exportFileStem('instagram', 'acc', 'notFollowingBack')).toBe('followlens-instagram-acc-notFollowingBack')
  })

  it('stays a usable filename when platform or account is missing', () => {
    expect(exportFileStem(null, null, 'current')).toBe('followlens-unknown-unknown-current')
  })
})
