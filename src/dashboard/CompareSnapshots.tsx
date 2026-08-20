import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GitCompareArrows } from 'lucide-react'
import { diffSnapshots } from '../lib/diff'
import { buildTaggedRows, type FilterKey, type Row } from '../lib/rows'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { FilterCheckboxes } from './FilterCheckboxes'
import { DiffResultsList } from './DiffResultsList'
import { RowDetailsDialog } from './RowDetailsDialog'
import type { PlatformId, Snapshot } from '../lib/types'

interface CompareSnapshotsProps {
  snapshots: Snapshot[] // full history for the account, oldest → newest
  platform: PlatformId
  onView: (snapshot: Snapshot) => void
}

// The full lists stay off here: Compare exists to answer "what changed between
// these two scans", and switching them on would bury that under the whole
// account. They remain available as boxes the user can tick.
const DEFAULT_FILTERS: Record<FilterKey, boolean> = {
  allFollowers: false,
  allFollowing: false,
  notFollowingBack: true,
  newFollowers: true,
  lostFollowers: true,
  newFollowing: true,
  lostFollowing: true,
}

function snapshotLabel(snapshot: Snapshot, locale: string): string {
  return `${new Date(snapshot.takenAt).toLocaleDateString(locale)} (${snapshot.followers.length}/${snapshot.following.length})`
}

export function CompareSnapshots({ snapshots, platform, onView }: CompareSnapshotsProps) {
  const { t, i18n } = useTranslation()
  const [baselineId, setBaselineId] = useState(() => String(snapshots[0]?.id ?? ''))
  const [targetId, setTargetId] = useState(() => String(snapshots[snapshots.length - 1]?.id ?? ''))
  const [search, setSearch] = useState('')
  const [detailsRow, setDetailsRow] = useState<Row | null>(null)
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>(DEFAULT_FILTERS)

  // Render-time adjust (not an effect): a new scan landing while Compare is
  // already open for this account moves the latest snapshot forward. Follow
  // it into `targetId` only if the user hadn't picked a different target
  // themselves — otherwise an intentional non-default comparison would get
  // silently reset every time a new scan comes in.
  const latestId = snapshots[snapshots.length - 1]?.id
  const [prevLatestId, setPrevLatestId] = useState(latestId)
  if (latestId !== prevLatestId) {
    if (targetId === String(prevLatestId ?? '')) setTargetId(String(latestId ?? ''))
    setPrevLatestId(latestId)
  }

  const baseline = snapshots.find((s) => String(s.id) === baselineId)
  const target = snapshots.find((s) => String(s.id) === targetId)
  const firstSnapshot = snapshots[0]
  const previousSnapshot = snapshots[snapshots.length - 2]
  const latestSnapshot = snapshots[snapshots.length - 1]

  function applyPreset(kind: 'previous' | 'first') {
    const baselineSnapshot = kind === 'previous' ? previousSnapshot : firstSnapshot
    if (!baselineSnapshot || !latestSnapshot) return
    setBaselineId(String(baselineSnapshot.id))
    setTargetId(String(latestSnapshot.id))
  }

  // Always diff in chronological order regardless of which dropdown the user
  // filled first — picking them "backwards" would otherwise flip new/lost
  // into their opposites, which is more confusing than just correcting it.
  const [older, newer] = useMemo(() => {
    if (!baseline || !target) return [undefined, undefined] as const
    return baseline.takenAt <= target.takenAt ? ([baseline, target] as const) : ([target, baseline] as const)
  }, [baseline, target])

  const diff = useMemo(() => (older && newer ? diffSnapshots(older, newer) : null), [older, newer])
  const rows = useMemo(() => buildTaggedRows(diff, filters, search), [diff, filters, search])

  const filterCounts: Record<FilterKey, number> = {
    allFollowers: diff?.allFollowers.length ?? 0,
    allFollowing: diff?.allFollowing.length ?? 0,
    notFollowingBack: diff?.notFollowingBack.length ?? 0,
    newFollowers: diff?.newFollowers.length ?? 0,
    lostFollowers: diff?.lostFollowers.length ?? 0,
    newFollowing: diff?.newFollowing.length ?? 0,
    lostFollowing: diff?.lostFollowing.length ?? 0,
  }

  if (snapshots.length < 2) {
    return (
      <div className="flex animate-fade-up flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <GitCompareArrows className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{t('noSnapshotsForComparison')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* htmlFor/id pairs: these two labels used to sit next to their dropdown
            with nothing connecting them, so a screen reader announced the
            triggers as unlabelled "baseline"/"target" buttons. */}
        <div>
          <label htmlFor="compare-baseline" className="mb-2 block text-xs font-medium text-muted-foreground">
            {t('baselineLabel')}
          </label>
          <Select value={baselineId} onValueChange={setBaselineId}>
            <SelectTrigger id="compare-baseline" className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {snapshots.map((snapshot) => (
                <SelectItem key={snapshot.id} value={String(snapshot.id)}>
                  {snapshotLabel(snapshot, i18n.language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="compare-target" className="mb-2 block text-xs font-medium text-muted-foreground">
            {t('targetLabel')}
          </label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger id="compare-target" className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {snapshots.map((snapshot) => (
                <SelectItem key={snapshot.id} value={String(snapshot.id)}>
                  {snapshotLabel(snapshot, i18n.language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {target && (
          <button
            type="button"
            className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => onView(target)}
          >
            {t('viewSnapshot')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => applyPreset('previous')}>
          {t('compareLatestPrevious')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => applyPreset('first')}>
          {t('compareLatestFirst')}
        </Button>
      </div>

      <FilterCheckboxes title={t('filters')} filters={filters} onFiltersChange={setFilters} counts={filterCounts} />

      {/* Rows open the same detail dialog as the main list — minus the ignore
          action, which belongs to the account's live view rather than to an
          arbitrary two-scan comparison. */}
      <DiffResultsList
        rows={rows}
        platform={platform}
        search={search}
        onSearchChange={setSearch}
        resultsLabel={t('resultsCount', { count: rows.length })}
        onOpenRow={setDetailsRow}
      />

      <RowDetailsDialog row={detailsRow} platform={platform} onClose={() => setDetailsRow(null)} />
    </div>
  )
}
