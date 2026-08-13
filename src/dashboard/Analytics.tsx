import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, CalendarX, Download, Eye, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react'
import { buildAccountHealth, buildGrowthSeries, filterSnapshotsByRange } from '../lib/analytics'
import { csvDelimiterFor, downloadFile, toCsv } from '../lib/export'
import { buildPortableHtmlReport, buildReportStrings } from '../lib/html-report'
import { printHtmlDocument } from '../lib/print-report'
import { directionFor } from '../lib/i18n'
import { endOfDayMs, startOfDayMs, toDateInputValue } from '../lib/format'
import { Button } from '../components/ui/button'
import { LineChart } from '../components/ui/line-chart'
import { StatCard } from '../components/ui/stat-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useToast } from '../components/ui/toast'
import { CompareSnapshots } from './CompareSnapshots'
import { FILTER_LABEL_KEYS } from './FilterCheckboxes'
import { RangeExportDialog } from './RangeExportDialog'
import { SnapshotDetailsView } from './SnapshotDetailsView'
import type { ExportFormat } from '../lib/export-view'
import type { PlatformId, Snapshot } from '../lib/types'

interface AnalyticsProps {
  platform: PlatformId
  accountId: string
  /** Display form of the account (`@name`) — only the exported report needs it. */
  accountLabel: string
  snapshots: Snapshot[]
}

export function Analytics({ platform, accountId, accountLabel, snapshots }: AnalyticsProps) {
  const { t } = useTranslation()
  const [innerTab, setInnerTab] = useState<'overview' | 'compare' | 'details'>('overview')
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null)
  // Remembers which tab "View" was launched from, so the details view's back
  // link returns to Overview or Compare as appropriate.
  const [detailsOrigin, setDetailsOrigin] = useState<'overview' | 'compare'>('overview')

  function viewSnapshot(snapshot: Snapshot, origin: 'overview' | 'compare') {
    setSelectedSnapshot(snapshot)
    setDetailsOrigin(origin)
    setInnerTab('details')
  }

  return (
    <Tabs value={innerTab} onValueChange={(value) => setInnerTab(value as typeof innerTab)} className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">{t('overviewTab')}</TabsTrigger>
        <TabsTrigger value="compare">{t('compareTab')}</TabsTrigger>
        {selectedSnapshot && <TabsTrigger value="details">{t('snapshotDetailsTab')}</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview">
        <AnalyticsOverview
          platform={platform}
          accountId={accountId}
          accountLabel={accountLabel}
          snapshots={snapshots}
          onView={(snapshot) => viewSnapshot(snapshot, 'overview')}
        />
      </TabsContent>

      <TabsContent value="compare">
        <CompareSnapshots
          snapshots={snapshots}
          platform={platform}
          onView={(snapshot) => viewSnapshot(snapshot, 'compare')}
        />
      </TabsContent>

      {selectedSnapshot && (
        <TabsContent value="details">
          <SnapshotDetailsView
            snapshot={selectedSnapshot}
            platform={platform}
            accountId={accountId}
            onBack={() => setInnerTab(detailsOrigin)}
          />
        </TabsContent>
      )}
    </Tabs>
  )
}

interface AnalyticsOverviewProps {
  platform: PlatformId
  accountId: string
  accountLabel: string
  snapshots: Snapshot[]
  onView: (snapshot: Snapshot) => void
}

function AnalyticsOverview({ platform, accountId, accountLabel, snapshots, onView }: AnalyticsOverviewProps) {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const earliest = snapshots[0]?.takenAt
  const latest = snapshots[snapshots.length - 1]?.takenAt

  const [fromDate, setFromDate] = useState(() => toDateInputValue(earliest ?? Date.now()))
  const [toDate, setToDate] = useState(() => toDateInputValue(latest ?? Date.now()))

  // Render-time adjust (not an effect): a new scan landing while this account
  // is already open moves `latest` forward. Auto-follow it into `toDate` only
  // when the user hadn't narrowed the range away from "up to the latest scan"
  // — otherwise a live-updating snapshot list would silently discard an
  // intentional narrower selection. Symmetric guard for `fromDate`/`earliest`
  // in case older history is ever pruned.
  const [prevEarliest, setPrevEarliest] = useState(earliest)
  const [prevLatest, setPrevLatest] = useState(latest)
  if (earliest !== prevEarliest) {
    if (earliest !== undefined && prevEarliest !== undefined && fromDate === toDateInputValue(prevEarliest)) {
      setFromDate(toDateInputValue(earliest))
    }
    setPrevEarliest(earliest)
  }
  if (latest !== prevLatest) {
    if (latest !== undefined && prevLatest !== undefined && toDate === toDateInputValue(prevLatest)) {
      setToDate(toDateInputValue(latest))
    }
    setPrevLatest(latest)
  }

  const rangeSnapshots = useMemo(
    () => filterSnapshotsByRange(snapshots, startOfDayMs(fromDate), endOfDayMs(toDate)),
    [snapshots, fromDate, toDate],
  )
  const series = useMemo(() => buildGrowthSeries(snapshots, rangeSnapshots), [snapshots, rangeSnapshots])
  const health = useMemo(() => buildAccountHealth(snapshots), [snapshots])

  // Net change across the whole selected range (last point vs. first point) —
  // deliberately not the sum of per-scan deltas, since those are each
  // measured against the previous scan in the FULL history and would double
  // count the range's own starting point.
  const netFollowers = series.length > 0 ? series[series.length - 1].followers - series[0].followers : 0
  const netFollowing = series.length > 0 ? series[series.length - 1].following - series[0].following : 0

  // Nothing to reset when the inputs already span the whole history — compared
  // against the stored bounds rather than "today" so this stays a pure render.
  const isFullRangeSelected =
    earliest === undefined ||
    latest === undefined ||
    (fromDate === toDateInputValue(earliest) && toDate === toDateInputValue(latest))

  function resetDateRange() {
    setFromDate(toDateInputValue(earliest ?? Date.now()))
    setToDate(toDateInputValue(latest ?? Date.now()))
  }

  const rangeFileStem = `followlens-${platform}-${accountId}-${fromDate}_${toDate}`

  function exportRangeCsv() {
    const headers = [t('tableDate'), t('healthFollowers'), t('chartLegendFollowing'), t('tableChange'), t('netFollowingChange')]
    const rows = series.map((p) => [new Date(p.takenAt).toISOString(), p.followers, p.following, p.followersDelta, p.followingDelta])
    downloadFile(`${rangeFileStem}.csv`, toCsv(headers, rows, csvDelimiterFor(i18n.resolvedLanguage)), 'text/csv;charset=utf-8;')
  }

  function exportRangeJson() {
    downloadFile(`${rangeFileStem}.json`, JSON.stringify(rangeSnapshots, null, 2), 'application/json')
  }

  /**
   * `rows` is deliberately left off: this report answers "how did the account
   * move over this range", not "who is in the list right now" — that one is the
   * results tab's export.
   */
  function buildRangeReport(): string {
    return buildPortableHtmlReport({
      appName: t('appName'),
      platform,
      accountLabel,
      generatedAt: Date.now(),
      snapshots: rangeSnapshots,
      series,
      language: i18n.resolvedLanguage ?? 'en',
      dir: directionFor(i18n.resolvedLanguage),
      strings: buildReportStrings(t),
      tagLabel: (tag) => t(FILTER_LABEL_KEYS[tag]),
    })
  }

  function runRangeExport() {
    if (rangeSnapshots.length === 0) return
    if (exportFormat === 'csv') exportRangeCsv()
    else if (exportFormat === 'json') exportRangeJson()
    else if (exportFormat === 'pdf') {
      printHtmlDocument(buildRangeReport()).catch(() => toast({ message: t('exportPdfFailed'), tone: 'error' }))
    } else {
      downloadFile(`${rangeFileStem}-report.html`, buildRangeReport(), 'text/html;charset=utf-8;')
    }
    setExportOpen(false)
  }

  function exportSingleScan(snapshot: Snapshot) {
    downloadFile(
      `followlens-${platform}-${accountId}-${toDateInputValue(snapshot.takenAt)}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json',
    )
  }

  return (
    <div className="space-y-4">
      {/* One card, two clearly separated jobs: pick the range on the left, act
          on that range on the right. Previously these were four loose controls
          on a bare row, with the buttons flung to the far edge by `ms-auto` and
          nothing tying them to the dates they operate on. */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border bg-card p-3 shadow-sm">
        <fieldset className="min-w-0">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t('dateRangeLegend')}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="analytics-date-from" className="text-2xs uppercase tracking-wide text-muted-foreground">
                {t('dateFrom')}
              </label>
              <input
                id="analytics-date-from"
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-md border border-border bg-transparent px-3 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <span aria-hidden="true" className="mt-5 text-muted-foreground">
              –
            </span>
            <div className="flex flex-col gap-1">
              <label htmlFor="analytics-date-to" className="text-2xs uppercase tracking-wide text-muted-foreground">
                {t('dateTo')}
              </label>
              <input
                id="analytics-date-to"
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-md border border-border bg-transparent px-3 text-sm tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-5 gap-2 text-muted-foreground"
              onClick={resetDateRange}
              disabled={isFullRangeSelected}
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              {t('resetDateRange')}
            </Button>
          </div>
        </fieldset>

        {/* One button opening a format picker, the same shape the results list
            uses — two loose buttons could only ever offer two of the four
            formats, and adding the report ones inline would have made a row of
            four competing outline buttons. */}
        <div className="flex flex-col gap-1">
          <span className="text-2xs uppercase tracking-wide text-muted-foreground">{t('dateRangeExportLegend')}</span>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setExportOpen(true)} disabled={rangeSnapshots.length === 0}>
            <Download className="h-3.5 w-3.5 shrink-0" />
            {t('exportRangeButton')}
          </Button>
        </div>
      </div>

      <RangeExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        format={exportFormat}
        onFormatChange={setExportFormat}
        scanCount={rangeSnapshots.length}
        onExport={runRangeExport}
      />

      {series.length === 0 ? (
        <div className="flex animate-fade-up flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <CalendarX className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t('noDataInRange')}</p>
          {/* The date range is the only thing that can have emptied this view,
              so widening it back to the full history is the recovery action —
              without it the state was a dead end the user had to undo by hand. */}
          {earliest !== undefined && latest !== undefined && (
            <Button size="sm" variant="outline" className="gap-2" onClick={resetDateRange}>
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              {t('resetDateRange')}
            </Button>
          )}
        </div>
      ) : (
        <>
          {health && (
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-medium">{t('accountHealthTitle')}</h2>
                {(health.unusualLoss || health.unusualGain) && (
                  <span className={health.unusualLoss ? 'ms-auto text-xs font-medium text-destructive' : 'ms-auto text-xs font-medium text-success'}>
                    {health.unusualLoss ? t('healthUnusualLoss') : t('healthUnusualGain')}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('healthFollowers')}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">{health.latestFollowers.toLocaleString(i18n.language)}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('healthRatio')}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {health.followingRatio === null ? '—' : health.followingRatio.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('healthNet7d')}</p>
                  <p className={health.net7d >= 0 ? 'mt-1 text-lg font-semibold tabular-nums text-success' : 'mt-1 text-lg font-semibold tabular-nums text-destructive'}>
                    {health.net7d > 0 ? '+' : ''}
                    {health.net7d.toLocaleString(i18n.language)}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">{t('healthNet30d')}</p>
                  <p className={health.net30d >= 0 ? 'mt-1 text-lg font-semibold tabular-nums text-success' : 'mt-1 text-lg font-semibold tabular-nums text-destructive'}>
                    {health.net30d > 0 ? '+' : ''}
                    {health.net30d.toLocaleString(i18n.language)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={netFollowers >= 0 ? TrendingUp : TrendingDown}
              value={netFollowers}
              label={t('netFollowerChange')}
              tone={netFollowers >= 0 ? 'success' : 'destructive'}
            />
            <StatCard
              icon={netFollowing >= 0 ? TrendingUp : TrendingDown}
              value={netFollowing}
              label={t('netFollowingChange')}
              tone={netFollowing >= 0 ? 'success' : 'destructive'}
            />
            <StatCard icon={TrendingUp} value={series.length} label={t('scansInRange')} tone="warning" />
          </div>

          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                {t('chartLegendFollowers')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--success))' }} />
                {t('chartLegendFollowing')}
              </span>
            </div>
            {series.length >= 2 ? (
              <div className="h-40">
                <LineChart
                  ariaLabel={t('chartAriaLabel', { from: fromDate, to: toDate })}
                  formatValue={(v) => v.toLocaleString(i18n.language)}
                  formatX={(x) => new Date(x).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
                  series={[
                    { color: 'hsl(var(--primary))', points: series.map((p) => ({ x: p.takenAt, y: p.followers })) },
                    { color: 'hsl(var(--success))', points: series.map((p) => ({ x: p.takenAt, y: p.following })) },
                  ]}
                />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t('notEnoughDataForChart')}</p>
            )}
          </div>

          <div className="overflow-hidden rounded-lg border border-border shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start font-medium">{t('tableDate')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('tableFollowers')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('tableFollowing')}</th>
                  <th className="px-3 py-2 text-end font-medium">{t('tableChange')}</th>
                  <th className="px-3 py-2 text-end font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[...series].reverse().map((point, reversedIndex) => {
                  const snapshot = rangeSnapshots[rangeSnapshots.length - 1 - reversedIndex]
                  return (
                    <tr key={point.takenAt} className="hover:bg-muted">
                      <td className="px-3 py-2">{new Date(point.takenAt).toLocaleDateString(i18n.language)}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{point.followers}</td>
                      <td className="px-3 py-2 text-end tabular-nums">{point.following}</td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        <span className={point.followersDelta > 0 ? 'text-success' : point.followersDelta < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                          {point.followersDelta > 0 ? '+' : ''}
                          {point.followersDelta}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-end">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            title={t('viewSnapshotHint')}
                            aria-label={t('viewSnapshotHint')}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => onView(snapshot)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title={t('downloadThisScan')}
                            aria-label={t('downloadThisScan')}
                            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={() => exportSingleScan(snapshot)}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
