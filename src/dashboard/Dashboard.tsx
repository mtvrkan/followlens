import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, Eye, EyeOff, ScanSearch, SlidersHorizontal, SquareArrowOutUpRight, UserMinus, UserPlus, Users, UserX } from 'lucide-react'
import { db, listKnownAccountIds } from '../lib/db'
import { diffSnapshots } from '../lib/diff'
import { accountKey } from '../lib/account-key'
import { formatRelativeTime } from '../lib/format'
import { csvDelimiterFor, downloadFile, toCsv } from '../lib/export'
import { buildPortableHtmlReport, buildReportStrings } from '../lib/html-report'
import { printHtmlDocument } from '../lib/print-report'
import { directionFor } from '../lib/i18n'
import { platformHomeUrl } from '../lib/profile-url'
import {
  buildTaggedRows,
  countActiveAttributeFilters,
  countByAttribute,
  filterByAttributes,
  NO_ATTRIBUTE_FILTERS,
  type AttributeFilters,
  type FilterKey,
  type Row,
} from '../lib/rows'
import {
  buildExportCells,
  DEFAULT_EXPORT_COLUMNS,
  exportFileStem,
  presetFilters,
  type ExportColumn,
  type ExportFormat,
  type ExportPreset,
} from '../lib/export-view'
import { getIgnoredUsernames, toggleIgnoredUsername } from '../lib/ignore-list'
import { ThemeProvider } from '../components/theme-provider'
import { AppHeader } from '../components/app-header'
import { ToastProvider, useToast } from '../components/ui/toast'
import { Analytics } from './Analytics'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { StatCard } from '../components/ui/stat-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DiffResultsList } from './DiffResultsList'
import { ExportDialog } from './ExportDialog'
import { FilterDialog } from './FilterDialog'
import { RowDetailsDialog } from './RowDetailsDialog'
import { FILTER_LABEL_KEYS } from './FilterCheckboxes'
import { Sidebar } from './Sidebar'
import { useAccountLabels, useAccountSelection } from '../lib/use-account-selection'
import { sendRuntimeMessage } from '../shared/messages'
import '../lib/i18n'
import '../styles/globals.css'

function formatAccountId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA'
}

function DashboardContent() {
  const { t, i18n } = useTranslation()
  const { platform, accountId, setPlatform } = useAccountSelection()
  const accountLabels = useAccountLabels()
  const toast = useToast()
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<'list' | 'analytics'>('list')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    allFollowers: false,
    allFollowing: false,
    notFollowingBack: true,
    newFollowers: false,
    lostFollowers: false,
    newFollowing: false,
    lostFollowing: false,
  })
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingSnapshotId, setDeletingSnapshotId] = useState<number | null>(null)
  const [ignoredUsernames, setIgnoredUsernames] = useState<Set<string>>(new Set())
  const [showIgnored, setShowIgnored] = useState(false)
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilters>(NO_ATTRIBUTE_FILTERS)
  const [filterOpen, setFilterOpen] = useState(false)
  const [detailsRow, setDetailsRow] = useState<Row | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [exportPreset, setExportPreset] = useState<ExportPreset>('current')
  const [exportColumns, setExportColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS)
  const [privacyScreen, setPrivacyScreen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Bumped after a successful delete to force platformSnapshots to re-query
  // Dexie directly, rather than relying solely on cross-context live-query
  // invalidation between the background service worker and this page.
  const [refreshTick, setRefreshTick] = useState(0)
  // Index into `snapshots` (oldest→newest) of the scan currently being
  // viewed — defaults to the latest one, but browsing history moves it back.
  const [selectedScanIndex, setSelectedScanIndex] = useState<number | null>(null)

  // Render-time adjust (not an effect): default to whichever account the
  // popup most recently scanned when the platform changes; once the user
  // picks a different account from the dropdown, leave that choice alone.
  const [prevPlatform, setPrevPlatform] = useState(platform)
  if (prevPlatform !== platform) {
    setPrevPlatform(platform)
    setSelectedAccountId(accountId)
  }

  const ignoreKey = `${platform ?? ''}:${selectedAccountId ?? ''}`
  const [prevIgnoreKey, setPrevIgnoreKey] = useState(ignoreKey)
  if (prevIgnoreKey !== ignoreKey) {
    setPrevIgnoreKey(ignoreKey)
    setIgnoredUsernames(new Set())
    setShowIgnored(false)
    setDetailsRow(null)
    setAttributeFilters(NO_ATTRIBUTE_FILTERS)
  }

  async function handleDeleteAccount() {
    if (!platform || !selectedAccountId) return
    setDeleting(true)
    const deletedId = selectedAccountId
    const res = await sendRuntimeMessage({ type: 'DELETE_ACCOUNT', platform, accountId: deletedId })
    if (res.ok) {
      // Fall back to another already-tracked account on this platform rather
      // than dropping to the "no scans yet" empty state when one is still
      // available — deleting one account shouldn't look like it wiped everything.
      setSelectedAccountId(knownAccountIds.find((id) => id !== deletedId) ?? null)
      setConfirmingDelete(false)
      setRefreshTick((n) => n + 1)
      toast({ message: t('deleteAccountDone') })
    } else {
      console.error('[FollowLens] account delete failed:', res.error)
      toast({ message: t('deleteAccountError'), tone: 'error' })
    }
    setDeleting(false)
  }

  async function handleDeleteSnapshot(snapshotId: number) {
    if (!platform || !selectedAccountId) return
    setDeletingSnapshotId(snapshotId)
    const res = await sendRuntimeMessage({ type: 'DELETE_SNAPSHOT', platform, accountId: selectedAccountId, snapshotId })
    if (res.ok) {
      setRefreshTick((n) => n + 1)
      toast({ message: t('deleteSnapshotDone') })
    } else {
      console.error('[FollowLens] snapshot delete failed:', res.error)
      toast({ message: t('deleteSnapshotError'), tone: 'error' })
    }
    setDeletingSnapshotId(null)
  }

  // Lightweight rollup (accountId + latest scan time only) — avoids loading
  // every account's full followers/following history just to populate the
  // account picker.
  const knownAccountIdsQuery = useLiveQuery(
    () => (platform ? listKnownAccountIds(platform) : []),
    [platform, refreshTick],
  )
  const knownAccountIds = knownAccountIdsQuery ?? []

  function accountLabel(id: string): string {
    if (!platform) return id
    const label = accountLabels[accountKey(platform, id)]
    return label ? `@${label}` : formatAccountId(id)
  }

  const snapshots = useLiveQuery(
    () =>
      platform && selectedAccountId
        ? db.snapshots.where('[platform+accountId]').equals([platform, selectedAccountId]).sortBy('takenAt')
        : [],
    [platform, selectedAccountId, refreshTick],
  )

  // Render-time adjust: jump back to "latest" whenever the account changes
  // or a new scan lands.
  const scanListKey = `${selectedAccountId ?? ''}:${snapshots?.length ?? 'loading'}`
  const [prevScanListKey, setPrevScanListKey] = useState(scanListKey)
  if (prevScanListKey !== scanListKey) {
    setPrevScanListKey(scanListKey)
    setSelectedScanIndex(snapshots && snapshots.length > 0 ? snapshots.length - 1 : null)
  }

  const viewingLatest = selectedScanIndex === null || (snapshots ? selectedScanIndex === snapshots.length - 1 : true)
  const currentSnapshot = snapshots && selectedScanIndex !== null ? snapshots[selectedScanIndex] : null

  const diff = useMemo(() => {
    if (!snapshots || selectedScanIndex === null) return null
    const current = snapshots[selectedScanIndex]
    // Guards a real transient state: deleting the selected account clears
    // `snapshots` before the render-time adjust above has a chance to pull
    // `selectedScanIndex` back in bounds for the new (shorter) array — same
    // render, so the out-of-bounds index is still what this reads.
    if (!current) return null
    const previous = snapshots[selectedScanIndex - 1]
    return diffSnapshots(previous, current)
  }, [snapshots, selectedScanIndex])

  useEffect(() => {
    if (!platform || !selectedAccountId) return

    let cancelled = false
    getIgnoredUsernames(platform, selectedAccountId)
      .then((usernames) => {
        if (!cancelled) setIgnoredUsernames(new Set(usernames))
      })
      // Storage unreachable (invalidated context after an extension reload):
      // treat it as "nothing ignored" rather than leaving a rejected promise.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [platform, selectedAccountId])

  // Attribute filters narrow the on-screen list (and therefore the "current
  // view" export) but deliberately not the sidebar's category counts — same as
  // search, which is also a view-level narrowing rather than a redefinition of
  // what each category contains.
  const rows = useMemo(
    () => filterByAttributes(buildTaggedRows(diff, filters, search, ignoredUsernames, showIgnored), attributeFilters),
    [attributeFilters, diff, filters, ignoredUsernames, search, showIgnored],
  )
  const rowsForCounts = useMemo(
    () =>
      buildTaggedRows(
        diff,
        {
          allFollowers: true,
          allFollowing: true,
          notFollowingBack: true,
          newFollowers: true,
          lostFollowers: true,
          newFollowing: true,
          lostFollowing: true,
        },
        '',
        ignoredUsernames,
        showIgnored,
      ),
    [diff, ignoredUsernames, showIgnored],
  )

  // Counted over every category with no attribute narrowing applied, so the
  // toggles can show how many rows they would leave — and hide themselves
  // entirely on a platform/scan that never reports the attribute at all.
  const attributeCounts = useMemo(() => countByAttribute(rowsForCounts), [rowsForCounts])
  const activeFilterCount = countActiveAttributeFilters(attributeFilters)

  const filterCounts: Record<FilterKey, number> = {
    allFollowers: rowsForCounts.filter((row) => row.tags.includes('allFollowers')).length,
    allFollowing: rowsForCounts.filter((row) => row.tags.includes('allFollowing')).length,
    notFollowingBack: rowsForCounts.filter((row) => row.tags.includes('notFollowingBack') && (!row.ignored || showIgnored)).length,
    newFollowers: rowsForCounts.filter((row) => row.tags.includes('newFollowers')).length,
    lostFollowers: rowsForCounts.filter((row) => row.tags.includes('lostFollowers')).length,
    newFollowing: rowsForCounts.filter((row) => row.tags.includes('newFollowing')).length,
    lostFollowing: rowsForCounts.filter((row) => row.tags.includes('lostFollowing')).length,
  }

  async function handleToggleIgnored(username: string) {
    if (!platform || !selectedAccountId) return
    try {
      const result = await toggleIgnoredUsername(platform, selectedAccountId, username)
      setIgnoredUsernames(new Set(result.usernames))
      toast({ message: result.ignored ? t('ignoreUserDone', { username }) : t('unignoreUserDone', { username }) })
    } catch {
      toast({ message: t('ignoreUserFailed'), tone: 'error' })
    }
  }

  // `current` is the list as filtered/searched on screen; the other presets are
  // built fresh from the diff so they do not depend on how the view is set up.
  const exportRows = useMemo(
    () =>
      exportPreset === 'current' ? rows : buildTaggedRows(diff, presetFilters(exportPreset), '', ignoredUsernames, showIgnored),
    [diff, exportPreset, ignoredUsernames, rows, showIgnored],
  )

  const exportCsv = useCallback(() => {
    if (exportRows.length === 0) return
    const headers = exportColumns.map((column) => t(`exportColumn_${column}`))
    const cells = buildExportCells(exportRows, exportColumns, platform, (tag) => t(FILTER_LABEL_KEYS[tag]))
    downloadFile(
      `${exportFileStem(platform, selectedAccountId, exportPreset)}.csv`,
      toCsv(headers, cells, csvDelimiterFor(i18n.resolvedLanguage)),
      'text/csv;charset=utf-8;',
    )
  }, [exportColumns, exportPreset, exportRows, i18n.resolvedLanguage, platform, selectedAccountId, t])

  const exportJson = useCallback(() => {
    if (!snapshots || snapshots.length === 0) return
    downloadFile(
      `${exportFileStem(platform, selectedAccountId, 'current')}-history.json`,
      JSON.stringify(snapshots, null, 2),
      'application/json',
    )
  }, [platform, selectedAccountId, snapshots])

  // Built once and shared by the HTML and PDF writers — they are the same
  // document, differing only in where it is sent.
  const buildReport = useCallback(() => {
    if (!platform || !selectedAccountId || !snapshots || snapshots.length === 0) return null
    return buildPortableHtmlReport({
      appName: t('appName'),
      platform,
      accountLabel: accountLabels[accountKey(platform, selectedAccountId)]
        ? `@${accountLabels[accountKey(platform, selectedAccountId)]}`
        : selectedAccountId,
      generatedAt: Date.now(),
      snapshots,
      rows: exportRows,
      language: i18n.resolvedLanguage ?? 'en',
      dir: directionFor(i18n.resolvedLanguage),
      strings: buildReportStrings(t),
      tagLabel: (tag) => t(FILTER_LABEL_KEYS[tag]),
    })
  }, [accountLabels, exportRows, i18n.resolvedLanguage, platform, selectedAccountId, snapshots, t])

  const exportHtmlReport = useCallback(() => {
    const html = buildReport()
    if (!html) return
    downloadFile(`${exportFileStem(platform, selectedAccountId, exportPreset)}-report.html`, html, 'text/html;charset=utf-8;')
  }, [buildReport, exportPreset, platform, selectedAccountId])

  const exportPdf = useCallback(() => {
    const html = buildReport()
    if (!html) return
    printHtmlDocument(html).catch(() => toast({ message: t('exportPdfFailed'), tone: 'error' }))
  }, [buildReport, t, toast])

  // One entry point for the dialog: the format choice picks the writer.
  const runExport = useCallback(() => {
    if (exportFormat === 'csv') exportCsv()
    else if (exportFormat === 'json') exportJson()
    else if (exportFormat === 'pdf') exportPdf()
    else exportHtmlReport()
    setExportOpen(false)
  }, [exportCsv, exportFormat, exportHtmlReport, exportJson, exportPdf])

  function openPlatform() {
    // .catch: chrome.tabs.create rejects on an invalidated context, and an
    // unhandled rejection from a click handler lands in the extension's error
    // list. There is nothing to recover — the URL is a fixed https address.
    if (platform) void chrome.tabs.create({ url: platformHomeUrl(platform) }).catch(() => undefined)
  }

  const loading = platform !== null && (knownAccountIdsQuery === undefined || snapshots === undefined)
  const noHistory = !loading && (!snapshots || snapshots.length === 0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return

      const key = event.key.toLowerCase()
      if (key === '/' && mainTab === 'list' && !noHistory) {
        event.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      // `e` opens the export dialog rather than firing a CSV download straight
      // away: the format/rows/columns choices now live there, so downloading
      // silently with whatever was last selected would be a surprise.
      if (key === 'e' && mainTab === 'list' && rows.length > 0) {
        event.preventDefault()
        setExportOpen(true)
        return
      }

      if (!snapshots || snapshots.length < 2 || selectedScanIndex === null) return
      if (key === 'j' && selectedScanIndex > 0) {
        event.preventDefault()
        setSelectedScanIndex(selectedScanIndex - 1)
      } else if (key === 'k' && selectedScanIndex < snapshots.length - 1) {
        event.preventDefault()
        setSelectedScanIndex(selectedScanIndex + 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mainTab, noHistory, rows.length, selectedScanIndex, snapshots])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader className="px-6" showSettings />

      <div className="flex">
        <Sidebar
          platform={platform}
          onPlatformChange={setPlatform}
          knownAccountIds={knownAccountIds}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          accountLabel={accountLabel}
          snapshots={snapshots}
          selectedScanIndex={selectedScanIndex}
          onScanIndexChange={setSelectedScanIndex}
          viewingLatest={viewingLatest}
          confirmingDelete={confirmingDelete}
          onConfirmingDeleteChange={setConfirmingDelete}
          deleting={deleting}
          onDeleteAccount={handleDeleteAccount}
          deletingSnapshotId={deletingSnapshotId}
          onDeleteSnapshot={handleDeleteSnapshot}
          showFilters={mainTab === 'list' && !noHistory}
          filters={filters}
          onFiltersChange={setFilters}
          filterCounts={filterCounts}
        />

        <main className="flex-1 p-6">
          {loading ? (
            <DashboardSkeleton />
          ) : noHistory ? (
            <div className="flex animate-fade-up flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <ScanSearch className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">{t('noScansYetTitle')}</p>
              <p className="max-w-sm text-xs text-muted-foreground">{t('noScansYetBody')}</p>
              {platform && (
                <Button size="sm" className="mt-1 gap-2" onClick={openPlatform}>
                  <SquareArrowOutUpRight className="h-3.5 w-3.5 shrink-0" />
                  {t('openPlatformCta', { platform: platform.charAt(0).toUpperCase() + platform.slice(1) })}
                </Button>
              )}
            </div>
          ) : (
            <Tabs value={mainTab} onValueChange={(value) => setMainTab(value as 'list' | 'analytics')} className="space-y-4">
              <TabsList>
                <TabsTrigger value="list">{t('followerListTab')}</TabsTrigger>
                <TabsTrigger value="analytics">{t('detailedAnalysisTab')}</TabsTrigger>
              </TabsList>

              <TabsContent value="list" className="space-y-4">
                {currentSnapshot && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <StatCard icon={Users} value={currentSnapshot.followers.length} label={t('followersCollected')} tone="default" />
                    <StatCard icon={Users} value={currentSnapshot.following.length} label={t('followingCollected')} tone="default" />
                    <StatCard icon={UserMinus} value={filterCounts.lostFollowers} label={t('lostFollowersCount')} tone="destructive" />
                    <StatCard icon={UserPlus} value={filterCounts.newFollowers} label={t('newFollowersCount')} tone="success" />
                    <StatCard icon={UserX} value={filterCounts.notFollowingBack} label={t('notFollowingBackCount')} tone="warning" />
                  </div>
                )}

                {!viewingLatest && currentSnapshot && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary shadow-sm">
                    {t('viewingOlderScan', { time: formatRelativeTime(currentSnapshot.takenAt, i18n.language) })}
                  </div>
                )}

                <DiffResultsList
                  rows={rows}
                  platform={platform}
                  search={search}
                  onSearchChange={setSearch}
                  searchInputRef={searchInputRef}
                  resultsLabel={t('resultsCount', { count: rows.length })}
                  onOpenRow={setDetailsRow}
                  filtersActive={activeFilterCount > 0}
                  onClearFilters={() => setAttributeFilters(NO_ATTRIBUTE_FILTERS)}
                  privacyScreen={privacyScreen}
                  actions={
                    <>
                      {/* Every narrowing choice lives behind this one button:
                          per-attribute chips could only say "only these" (never
                          "everything except these") and pushed the toolbar into
                          overflow as soon as two appeared. The badge is how many
                          filters are currently narrowing the list. */}
                      <Button
                        size="sm"
                        variant={activeFilterCount > 0 || showIgnored ? 'default' : 'outline'}
                        className="gap-2"
                        onClick={() => setFilterOpen(true)}
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                        {t('filterButton')}
                        {activeFilterCount > 0 && <span className="tabular-nums opacity-70">{activeFilterCount}</span>}
                      </Button>
                      <Button size="sm" variant={privacyScreen ? 'default' : 'outline'} className="gap-2" onClick={() => setPrivacyScreen((value) => !value)}>
                        {privacyScreen ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}
                        {privacyScreen ? t('privacyScreenOff') : t('privacyScreenOn')}
                      </Button>
                      {/* One button for every export: format, row selection and
                          columns all live in the dialog it opens, instead of three
                          buttons plus two dropdowns crowding this toolbar. */}
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setExportOpen(true)}>
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        {t('exportButton')}
                      </Button>
                    </>
                  }
                />

                <FilterDialog
                  open={filterOpen}
                  onClose={() => setFilterOpen(false)}
                  filters={attributeFilters}
                  onFiltersChange={setAttributeFilters}
                  showIgnored={showIgnored}
                  onShowIgnoredChange={setShowIgnored}
                  ignoredCount={ignoredUsernames.size}
                  counts={attributeCounts}
                />

                <RowDetailsDialog
                  row={detailsRow}
                  platform={platform}
                  onClose={() => setDetailsRow(null)}
                  onToggleIgnored={(row) => void handleToggleIgnored(row.username)}
                />

                <ExportDialog
                  open={exportOpen}
                  onClose={() => setExportOpen(false)}
                  format={exportFormat}
                  onFormatChange={setExportFormat}
                  preset={exportPreset}
                  onPresetChange={setExportPreset}
                  columns={exportColumns}
                  onColumnsChange={setExportColumns}
                  rowCount={exportRows.length}
                  snapshotCount={snapshots?.length ?? 0}
                  onExport={runExport}
                />
              </TabsContent>

              <TabsContent value="analytics">
                {platform && selectedAccountId ? (
                  // Keyed by account: date-range and compare selections inside
                  // Analytics must reset when switching accounts, not leak across.
                  <Analytics
                    key={accountKey(platform, selectedAccountId)}
                    platform={platform}
                    accountId={selectedAccountId}
                    accountLabel={accountLabel(selectedAccountId)}
                    snapshots={snapshots ?? []}
                  />
                ) : (
                  <div className="flex animate-fade-up flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('noAccountYet')}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  )
}

/** Mirrors the list view's real layout: stat cards row + search bar + result rows. */
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-9 max-w-sm" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DashboardContent />
      </ToastProvider>
    </ThemeProvider>
  )
}
