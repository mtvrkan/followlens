import { useTranslation } from 'react-i18next'
import { Users, UserPlus } from 'lucide-react'
import { Badge, type BadgeProps } from '../components/ui/badge'
import { Checkbox } from '../components/ui/checkbox'
import type { FilterKey } from '../lib/rows'

export const FILTER_LABEL_KEYS: Record<FilterKey, string> = {
  allFollowers: 'filterAllFollowers',
  allFollowing: 'filterAllFollowing',
  notFollowingBack: 'filterNotFollowingBack',
  newFollowers: 'filterNewFollowers',
  lostFollowers: 'filterLostFollowers',
  newFollowing: 'filterNewFollowing',
  lostFollowing: 'filterLostFollowing',
}

export const FILTER_BADGE_TONES: Record<FilterKey, BadgeProps['variant']> = {
  // Muted, unlike the change categories: these two are not news, they are the
  // whole list. A coloured badge would put them on the same footing as
  // "someone unfollowed you".
  allFollowers: 'muted',
  allFollowing: 'muted',
  notFollowingBack: 'warning',
  newFollowers: 'success',
  lostFollowers: 'destructive',
  newFollowing: 'default',
  lostFollowing: 'warning',
}

/**
 * The categories are two different questions, and reading them as one flat
 * list is what made them easy to confuse ("new followers" vs "new following"
 * differ by one word). Grouped by which side of the relationship they describe:
 * who follows you, versus who you follow.
 *
 * Each group leads with its full list — that is the category that always has
 * something in it, including on a first scan where every change category is
 * still empty.
 */
const FILTER_GROUPS: { titleKey: string; icon: typeof Users; keys: FilterKey[] }[] = [
  { titleKey: 'filterGroupFollowers', icon: Users, keys: ['allFollowers', 'newFollowers', 'lostFollowers'] },
  { titleKey: 'filterGroupFollowing', icon: UserPlus, keys: ['allFollowing', 'notFollowingBack', 'newFollowing', 'lostFollowing'] },
]

const FILTER_KEYS = FILTER_GROUPS.flatMap((group) => group.keys)

function allFiltersSetTo(value: boolean): Record<FilterKey, boolean> {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, value])) as Record<FilterKey, boolean>
}

interface FilterCheckboxesProps {
  title: string
  filters: Record<FilterKey, boolean>
  onFiltersChange: (filters: Record<FilterKey, boolean>) => void
  counts: Record<FilterKey, number>
}

/** Shared by the main follower-list view and the snapshot-comparison view — both need the same "which categories to show" checkboxes with select-all/isolate-one affordances. */
export function FilterCheckboxes({ title, filters, onFiltersChange, counts }: FilterCheckboxesProps) {
  const { t } = useTranslation()
  const allActive = FILTER_KEYS.every((key) => filters[key])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-muted-foreground">{title}</h2>
        <button
          type="button"
          className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => onFiltersChange(allFiltersSetTo(!allActive))}
        >
          {allActive ? t('clearAllFilters') : t('selectAllFilters')}
        </button>
      </div>

      <div className="space-y-3">
        {FILTER_GROUPS.map(({ titleKey, icon: Icon, keys }) => (
          <div key={titleKey} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t(titleKey)}</h3>
            </div>
            <div className="divide-y divide-border">
              {keys.map((key) => {
                const active = filters[key]
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 text-sm transition-colors ${
                      active ? 'bg-primary/5' : 'hover:bg-muted'
                    }`}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={active}
                        onCheckedChange={(checked) => onFiltersChange({ ...filters, [key]: checked === true })}
                      />
                      <span className={`min-w-0 truncate ${active ? 'font-medium' : undefined}`}>{t(FILTER_LABEL_KEYS[key])}</span>
                    </label>
                    <button
                      type="button"
                      title={t('isolateFilterHint')}
                      aria-label={t('isolateFilterHint')}
                      className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      onClick={() => onFiltersChange({ ...allFiltersSetTo(false), [key]: true })}
                    >
                      <Badge variant={FILTER_BADGE_TONES[key]} className="min-w-8 justify-center tabular-nums">
                        {counts[key]}
                      </Badge>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
