import { profileUrl } from './profile-url'
import type { FilterKey, Row } from './rows'
import type { PlatformId } from './types'

/**
 * What the export dialog can produce. `html` is the self-contained offline
 * report; `pdf` is that same report sent to the browser's print dialog rather
 * than downloaded (see `print-report.ts` for why it works that way).
 */
export type ExportFormat = 'csv' | 'json' | 'html' | 'pdf'

/**
 * Which rows to export. `current` means "whatever the list is showing right
 * now" (the user's own filters + search); the others are fixed selections that
 * ignore the on-screen filters, so a common export doesn't require setting the
 * view up first.
 */
export type ExportPreset = 'current' | 'allFollowers' | 'allFollowing' | 'notFollowingBack' | 'lostFollowers'

export type ExportColumn = 'username' | 'displayName' | 'profileUrl' | 'tags' | 'ignored' | 'platform'

export const EXPORT_COLUMNS: ExportColumn[] = ['username', 'displayName', 'profileUrl', 'tags', 'ignored', 'platform']

export const DEFAULT_EXPORT_COLUMNS: ExportColumn[] = ['username', 'displayName', 'tags']

/** Filter set a non-`current` preset stands for — fed to `buildTaggedRows` in place of the view's own filters. */
export function presetFilters(preset: Exclude<ExportPreset, 'current'>): Record<FilterKey, boolean> {
  return {
    allFollowers: preset === 'allFollowers',
    allFollowing: preset === 'allFollowing',
    notFollowingBack: preset === 'notFollowingBack',
    newFollowers: false,
    lostFollowers: preset === 'lostFollowers',
    newFollowing: false,
    lostFollowing: false,
  }
}

/**
 * Keeps at least one column selected — an export with no columns produces a file
 * of empty lines, which looks like a broken export rather than a chosen one.
 * Order follows `EXPORT_COLUMNS` regardless of the order boxes were ticked, so
 * the same selection always yields the same file layout.
 */
export function toggleExportColumn(columns: ExportColumn[], column: ExportColumn, checked: boolean): ExportColumn[] {
  const next = checked ? [...new Set([...columns, column])] : columns.filter((item) => item !== column)
  if (next.length === 0) return columns
  return EXPORT_COLUMNS.filter((item) => next.includes(item))
}

/** One CSV cell per selected column, in `EXPORT_COLUMNS` order. `tagLabel` localizes each category name. */
export function buildExportCells(
  rows: Row[],
  columns: ExportColumn[],
  platform: PlatformId | null,
  tagLabel: (tag: FilterKey) => string,
): string[][] {
  return rows.map((row) =>
    columns.map((column) => {
      switch (column) {
        case 'username':
          return row.username
        case 'displayName':
          return row.displayName
        case 'profileUrl':
          return profileUrl(platform, row.username)
        case 'tags':
          return row.tags.map(tagLabel).join(' | ')
        case 'ignored':
          return row.ignored ? 'yes' : 'no'
        case 'platform':
          return platform ?? ''
      }
    }),
  )
}

/** `followlens-<platform>-<account>-<preset>` — the shared stem for every exported filename. */
export function exportFileStem(platform: PlatformId | null, accountId: string | null, preset: ExportPreset): string {
  return `followlens-${platform ?? 'unknown'}-${accountId ?? 'unknown'}-${preset}`
}
