import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Inbox, RotateCcw, Search } from 'lucide-react'
import { Avatar } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { UserBadges } from '../components/user-badges'
import { FILTER_BADGE_TONES, FILTER_LABEL_KEYS } from './FilterCheckboxes'
import { profileUrl } from '../lib/profile-url'
import type { Row } from '../lib/rows'
import type { PlatformId } from '../lib/types'

interface DiffResultsListProps {
  rows: Row[]
  platform: PlatformId | null
  search: string
  onSearchChange: (value: string) => void
  searchInputRef?: RefObject<HTMLInputElement>
  resultsLabel?: string
  actions?: ReactNode
  /** Opens the row's detail dialog. When omitted the row is not interactive (comparison view). */
  onOpenRow?: (row: Row) => void
  /** Set when a narrowing filter (not the search box) is on, so an empty list can say so and offer a way back. */
  filtersActive?: boolean
  onClearFilters?: () => void
  privacyScreen?: boolean
}

/** The tagged-row list (avatar, name, category badges) shared by the main follower-list view and the snapshot-comparison view. */
export function DiffResultsList({
  rows,
  platform,
  search,
  onSearchChange,
  searchInputRef,
  resultsLabel,
  actions,
  onOpenRow,
  filtersActive = false,
  onClearFilters,
  privacyScreen = false,
}: DiffResultsListProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* start-2/ps-8 rather than left-2/pl-8: under dir="rtl" the icon has
            to sit at the inline start too, otherwise it lands on top of the
            text the padding was reserving room for. */}
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="search"
            aria-label={t('searchPlaceholder')}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="ps-8"
          />
        </div>
        {resultsLabel && <span className="text-xs text-muted-foreground">{resultsLabel}</span>}
        {actions && <div className="ms-auto flex gap-2">{actions}</div>}
      </div>

      <div className="overflow-hidden rounded-lg border border-border shadow-sm">
        {rows.length === 0 && (
          <div className="flex animate-fade-up flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {search ? (
                <Search className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Inbox className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            {/* Three different reasons for an empty list, three different
                messages: the search matched nothing, a filter narrowed
                everything away, or there is genuinely no data yet. Saying
                "no results yet, save a scan first" while a filter is the actual
                cause sends the user looking in the wrong place. */}
            <p className="text-sm text-muted-foreground">
              {search ? t('noSearchResults', { search }) : filtersActive ? t('noFilterResults') : t('emptyState')}
            </p>
            {search ? (
              <Button size="sm" variant="outline" className="mt-1 gap-2" onClick={() => onSearchChange('')}>
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                {t('clearSearch')}
              </Button>
            ) : (
              filtersActive &&
              onClearFilters && (
                <Button size="sm" variant="outline" className="mt-1 gap-2" onClick={onClearFilters}>
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  {t('clearFilters')}
                </Button>
              )
            )}
          </div>
        )}
        <div className="divide-y divide-border">
          {rows.map((row, index) => (
            <div
              key={row.username}
              className="flex animate-fade-up items-center gap-3 p-3 transition-colors hover:bg-muted hover:ring-1 hover:ring-inset hover:ring-border"
              style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
            >
              {/* The row itself opens the detail dialog; going to the profile is
                  the separate icon at the end. A <button> (not a wrapping <a>)
                  because that is what it now does — and it keeps the profile
                  link from being nested inside another interactive element. */}
              {onOpenRow ? (
                <button
                  type="button"
                  onClick={() => onOpenRow(row)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <RowIdentity row={row} privacyScreen={privacyScreen} />
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <RowIdentity row={row} privacyScreen={privacyScreen} />
                </div>
              )}

              <div className="flex shrink-0 flex-nowrap gap-2">
                {row.ignored && <Badge variant="muted">{t('ignoredBadge')}</Badge>}
                {row.tags.map((tag) => (
                  <Badge key={tag} variant={FILTER_BADGE_TONES[tag]}>
                    {t(FILTER_LABEL_KEYS[tag])}
                  </Badge>
                ))}
              </div>

              <a
                href={profileUrl(platform, row.username)}
                target="_blank"
                rel="noreferrer"
                title={t('openProfile')}
                aria-label={t('openProfile')}
                className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RowIdentity({ row, privacyScreen }: { row: Row; privacyScreen: boolean }) {
  return (
    <>
      <div className={privacyScreen ? 'blur-sm' : undefined}>
        <Avatar src={row.avatarUrl} fallbackText={row.username} size={36} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium">
          <span className="min-w-0 truncate">{privacyScreen ? '@••••••' : `@${row.username}`}</span>
          {!privacyScreen && <UserBadges user={row} />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{privacyScreen ? '••••••••' : row.displayName}</p>
      </div>
    </>
  )
}
