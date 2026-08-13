import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, CheckCircle2, Compass, Info, Play, RefreshCw, RotateCcw, ShieldCheck, Square, SquareArrowOutUpRight, UserMinus, UserPlus, Users, UserX, XCircle } from 'lucide-react'
import { db } from '../lib/db'
import { DeveloperCredit } from '../components/developer-credit'
import { formatRelativeTime } from '../lib/format'
import { assessScanQuality, type ScanQuality } from '../lib/scan-quality'
import { ThemeProvider } from '../components/theme-provider'
import { AppHeader } from '../components/app-header'
import { ToastProvider, useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { StatCard } from '../components/ui/stat-card'
import { useAccountLabels, useAccountSelection } from '../lib/use-account-selection'
import { accountKey } from '../lib/account-key'
import { sendRuntimeMessage, sendTabMessage, type BufferStatus } from '../shared/messages'
import { adaptersById, getAdapterForHost } from '../platforms/registry'
import { PLATFORM_ICON_CLASSES, PLATFORM_ICONS } from '../lib/platform-meta'
import { adapters, enabledAdapters } from '../platforms/registry'
import type { PlatformId, SaveSnapshotResult, SnapshotDiff, SnapshotSizeWarning } from '../lib/types'
import '../lib/i18n'
import '../styles/globals.css'

// The list is considered "probably fully loaded" after this many consecutive
// polls (~1.2 s each) with no growth while auto-collection is running.
const STABLE_ROUNDS_FOR_HINT = 4

type TabDiagnostic = 'no-active-tab' | 'unsupported-tab' | 'different-platform' | 'content-script-unavailable'
type PopupTabState = { tabId: number; collecting: boolean; guidedComplete: boolean | null }

const QUALITY_STYLES: Record<ScanQuality['level'], { icon: typeof ShieldCheck; badge: 'success' | 'warning' | 'destructive'; card: string }> = {
  good: {
    icon: ShieldCheck,
    badge: 'success',
    card: 'border-success/30 bg-success/10 text-success',
  },
  partial: {
    icon: Info,
    badge: 'warning',
    card: 'border-warning/30 bg-warning/10 text-warning',
  },
  risky: {
    icon: AlertTriangle,
    badge: 'destructive',
    card: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Prefers comparing against the platform's own stated total (ground truth,
// available even on a first-ever scan) over the previous-snapshot ratio
// check — it's the more precise, more actionable of the two whenever both
// are available for the same direction.
function describeSizeWarning(warning: SnapshotSizeWarning, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (warning.expectedFollowers != null && warning.followers < warning.expectedFollowers) {
    return t('lowDataWarningExpected', { count: warning.followers, expected: warning.expectedFollowers })
  }
  if (warning.expectedFollowing != null && warning.following < warning.expectedFollowing) {
    return t('lowDataWarningExpected', { count: warning.following, expected: warning.expectedFollowing })
  }
  return t('lowDataWarning', { count: warning.followers, previous: warning.previousFollowers })
}

async function injectContentScript(tabId: number): Promise<boolean> {
  const script = chrome.runtime
    .getManifest()
    .content_scripts?.find((entry) => entry.js?.some((file) => file.includes('content-script')))
  const files = script?.js
  if (!files?.length) return false

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files })
    await sleep(150)
    return true
  } catch {
    return false
  }
}

async function getActivePlatformTab(platform: PlatformId): Promise<{ ok: true; tabId: number } | { ok: false; diagnostic: TabDiagnostic }> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url) return { ok: false, diagnostic: 'no-active-tab' }
    const tabPlatform = getAdapterForHost(new URL(tab.url).hostname)?.id ?? null
    if (!tabPlatform) return { ok: false, diagnostic: 'unsupported-tab' }
    if (tabPlatform !== platform) return { ok: false, diagnostic: 'different-platform' }
    return { ok: true, tabId: tab.id }
  } catch {
    return { ok: false, diagnostic: 'content-script-unavailable' }
  }
}

async function getInjectedTabState(tabId: number): Promise<PopupTabState | null> {
  let state = await sendTabMessage(tabId, { type: 'GET_SCAN_STATE' })
  if (!state.ok && (await injectContentScript(tabId))) {
    for (let attempt = 0; attempt < 8; attempt++) {
      await sleep(250)
      state = await sendTabMessage(tabId, { type: 'GET_SCAN_STATE' })
      if (state.ok) break
    }
  }
  return state.ok ? { tabId, collecting: state.value.collecting, guidedComplete: state.value.guidedComplete } : null
}

function PopupContent() {
  const { t, i18n } = useTranslation()
  const { platform, accountId, activeAccountId, setPlatform, setAccount, lastAccounts } = useAccountSelection()
  const accountLabels = useAccountLabels()
  const toast = useToast()
  const [status, setStatus] = useState<BufferStatus | null>(null)
  const [growing, setGrowing] = useState(false)
  const [stableRounds, setStableRounds] = useState(0)
  const [diff, setDiff] = useState<SnapshotDiff | null>(null)
  const [warning, setWarning] = useState<SnapshotSizeWarning | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<'failed' | 'no-data' | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [connecting, setConnecting] = useState(false)
  // Set when the active tab is on the selected platform and has our content
  // script — i.e. when auto-collection can be started/stopped from here.
  const [tabState, setTabState] = useState<PopupTabState | null>(null)
  const [tabDiagnostic, setTabDiagnostic] = useState<TabDiagnostic | null>(null)

  // Moves focus into the reset-confirm panel when it appears — otherwise
  // keyboard and screen-reader users get no signal that a destructive
  // confirmation step just replaced the button they were on.
  const resetConfirmRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (confirmingReset) resetConfirmRef.current?.focus()
  }, [confirmingReset])

  // Sticky version of `tabState?.collecting`, for the stall-based
  // "looks complete" heuristic below — the buffer-status poll keeps running
  // (and stableRounds keeps climbing) even after the user stops collection,
  // so gating on the *live* collecting flag would make the checkmark vanish
  // the instant Stop is pressed, even if the data had actually stabilized.
  const [everCollected, setEverCollected] = useState(false)

  // Render-time reset (not an effect): switching platform/account discards
  // results and progress that belonged to the previous selection.
  const selectionKey = `${platform ?? ''}:${accountId ?? ''}`
  const [prevSelectionKey, setPrevSelectionKey] = useState(selectionKey)
  if (prevSelectionKey !== selectionKey) {
    setPrevSelectionKey(selectionKey)
    setStatus(null)
    setGrowing(false)
    setStableRounds(0)
    setDiff(null)
    setWarning(null)
    setSaveError(null)
      setConfirmingReset(false)
      setEverCollected(false)
      setConnecting(false)
      setTabState(null)
      setTabDiagnostic(null)
  }

  const scanCount = useLiveQuery(
    () => (platform && accountId ? db.snapshots.where('[platform+accountId]').equals([platform, accountId]).count() : 0),
    [platform, accountId],
  )
  const lastSnapshot = useLiveQuery(
    () => (platform && accountId ? db.snapshots.where('[platform+accountId]').equals([platform, accountId]).last() : undefined),
    [platform, accountId],
  )

  // Auto-collection is per-tab and doesn't require a prior scan of this
  // account — offering it only depends on the active tab being on the
  // selected platform and our content script answering. Gating this on
  // `accountId` too would make it impossible to ever start a first scan:
  // accountId is only set once the content script has already reported
  // data, which for a brand-new account only happens *after* collection starts.
  useEffect(() => {
    if (!platform) return

    let cancelled = false

    const pollScanState = async () => {
      let next: PopupTabState | null = null
      let diagnostic: TabDiagnostic | null = null
      const target = await getActivePlatformTab(platform)
      if (target.ok) {
        next = await getInjectedTabState(target.tabId)
        if (!next) diagnostic = 'content-script-unavailable'
      } else {
        diagnostic = target.diagnostic
      }
      if (!cancelled) {
        if (next?.collecting) setEverCollected(true)
        setTabState(next)
        setTabDiagnostic(next ? null : diagnostic)
      }
    }

    pollScanState()
    const interval = setInterval(pollScanState, 1200)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [platform])

  async function ensureTabConnection(): Promise<PopupTabState | null> {
    if (!platform) return null
    const target = await getActivePlatformTab(platform)
    if (!target.ok) {
      setTabState(null)
      setTabDiagnostic(target.diagnostic)
      return null
    }

    const next = await getInjectedTabState(target.tabId)
    if (!next) {
      setTabState(null)
      setTabDiagnostic('content-script-unavailable')
      return null
    }

    setTabState(next)
    setTabDiagnostic(null)
    if (next.collecting) setEverCollected(true)
    return next
  }

  // Buffer-status counters need a concrete accountId, which only exists once
  // the background has seen at least one report for this account — so this
  // polls separately from (and starts later than) the tab-state effect above.
  useEffect(() => {
    if (!platform || !accountId) return

    let cancelled = false
    let lastTotal = -1

    const poll = async () => {
      // A failed poll (background waking up from suspension) is retried on
      // the next tick rather than surfaced — sendRuntimeMessage never throws.
      const res = await sendRuntimeMessage({ type: 'GET_BUFFER_STATUS', platform, accountId })
      if (cancelled || !res.ok) return
      setStatus(res.value)
      const total = res.value.followers + res.value.following
      setGrowing(lastTotal >= 0 && total > lastTotal)
      setStableRounds((rounds) => (lastTotal >= 0 && total === lastTotal && total > 0 ? rounds + 1 : 0))
      lastTotal = total
    }

    poll()
    const interval = setInterval(poll, 1200)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [platform, accountId])

  async function handleSave(force = false) {
    if (!platform || !accountId) return
    if (!force && totalCollected === 0 && !tabState?.collecting && adaptersById[platform]?.openList) {
      setSaveError(null)
      await toggleCollecting()
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const res = await sendRuntimeMessage({ type: 'SAVE_SNAPSHOT', platform, accountId, force })
      if (!res.ok) {
        setSaveError('failed')
        return
      }
      const result: SaveSnapshotResult = res.value
      if (result.status === 'saved') {
        setDiff(result.diff)
        setWarning(null)
        toast({ message: t('scanSaved') })
        // The scan is complete — collection has nothing left to do in this tab.
        if (tabState?.collecting) {
          sendTabMessage(tabState.tabId, { type: 'SCAN_CONTROL', action: 'stop' })
          setTabState({ tabId: tabState.tabId, collecting: false, guidedComplete: tabState.guidedComplete })
        }
      } else if (result.status === 'needs-confirmation') {
        setWarning(result.warning)
      } else {
        setSaveError('no-data')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleCollecting() {
    setConnecting(true)
    try {
      const currentTabState = tabState ?? (await ensureTabConnection())
      if (!currentTabState) return
      const res = await sendTabMessage(currentTabState.tabId, {
        type: 'SCAN_CONTROL',
        action: currentTabState.collecting ? 'stop' : 'start',
      })
      if (res.ok) {
        if (res.value.collecting) setEverCollected(true)
        setTabState({ tabId: currentTabState.tabId, collecting: res.value.collecting, guidedComplete: res.value.guidedComplete })
        setTabDiagnostic(null)
      } else {
        setTabState(null)
        setTabDiagnostic('content-script-unavailable')
      }
    } finally {
      setConnecting(false)
    }
  }

  // Discards the in-progress (unsaved) scan — the fix for when collection
  // went wrong (e.g. one direction's rows ended up mislabeled as the other)
  // so the user can start over clean without losing previously saved history.
  async function handleResetBuffer() {
    if (!platform || !accountId) return
    setResetting(true)
    try {
      // Stop first: otherwise the content script would likely just re-report
      // whatever's currently on screen a moment later, undoing the reset.
      if (tabState?.collecting) {
        await sendTabMessage(tabState.tabId, { type: 'SCAN_CONTROL', action: 'stop' })
        setTabState({ tabId: tabState.tabId, collecting: false, guidedComplete: tabState.guidedComplete })
      }
      // Clears the content script's own "already sent this user" memory too —
      // without it, restarting collection would silently skip re-sending
      // everyone already seen once, and the reset would look like it did nothing.
      if (tabState) await sendTabMessage(tabState.tabId, { type: 'RESET_COLLECTED' })

      const res = await sendRuntimeMessage({ type: 'RESET_BUFFER', platform, accountId })
      if (res.ok) {
        setStatus({ followers: 0, following: 0 })
        setGrowing(false)
        setStableRounds(0)
        setConfirmingReset(false)
        toast({ message: t('resetBufferDone') })
      } else {
        toast({ message: t('resetBufferFailed'), tone: 'error' })
      }
    } finally {
      setResetting(false)
    }
  }

  function openDashboard() {
    void chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/index.html') }).catch(() => undefined)
  }

  const PlatformIcon = platform ? PLATFORM_ICONS[platform] : null
  const platformLabel = platform ? adapters.find((adapter) => adapter.id === platform)?.label : null
  const accountOptions = useMemo(() => {
    if (!platform) return []
    const seen = new Set<string>()
    const add = (value: string | null | undefined) => {
      if (value) seen.add(value)
    }
    add(activeAccountId)
    add(lastAccounts[platform])
    const prefix = `${platform}:`
    for (const key of Object.keys(accountLabels)) {
      if (key.startsWith(prefix)) add(key.slice(prefix.length))
    }
    return [...seen]
  }, [accountLabels, activeAccountId, lastAccounts, platform])
  const totalCollected = (status?.followers ?? 0) + (status?.following ?? 0)
  // Instagram-style guided adapters report real completion of the
  // followers→following sequence — trust that over the stall heuristic below,
  // which can't tell "genuinely done" apart from "paused mid-list" or
  // "switching from followers to following" and used to fire in both cases.
  const guidedComplete = tabState?.guidedComplete ?? null
  const looksComplete =
    guidedComplete !== null
      ? guidedComplete && totalCollected > 0
      : everCollected && totalCollected > 0 && stableRounds >= STABLE_ROUNDS_FOR_HINT
  const scanQuality = assessScanQuality({
    followers: status?.followers ?? 0,
    following: status?.following ?? 0,
    previous: lastSnapshot,
    expectedFollowers: status?.expectedFollowers,
    expectedFollowing: status?.expectedFollowing,
    collecting: tabState?.collecting ?? false,
    looksComplete,
  })
  const QualityIcon = scanQuality ? QUALITY_STYLES[scanQuality.level].icon : null
  // The green "list looks fully loaded" line is the strongest claim in the
  // popup, and it used to rest on the guided flow finishing alone — which says
  // the sequence ran to its end, not that it found everyone. So it appeared
  // beside "68 collected" on a profile stating 69 followers. A known shortfall
  // now silences it; the quality panel above still explains where things stand.
  const listFullyLoaded = looksComplete && !scanQuality?.gap
  const activeAccountMismatch = !!activeAccountId && !!accountId && activeAccountId !== accountId

  function formatAccountOption(id: string): string {
    if (!platform) return id
    return accountLabels[accountKey(platform, id)] ? `@${accountLabels[accountKey(platform, id)]}` : `@${id}`
  }

  // Not gated on adaptersById[platform]?.openList: that flag means "this
  // adapter can open the list itself" (Instagram), not "this adapter
  // supports active collection at all". Adapters without it (GitHub)
  // still need an explicit start to enable pagination/auto-scroll
  // — gating on openList here left them with no way to ever reach
  // 'start' at all, jumping straight to 'save' on an empty scan instead.
  const primaryAction =
    tabState?.collecting
      ? 'stop'
      : platform && accountId && totalCollected === 0
        ? 'start'
        : 'save'
  const primaryActionLabel =
    primaryAction === 'stop'
      ? t('stopCollecting')
      : primaryAction === 'start'
        ? t('startCollectingShort')
        : t('saveScan')
  const PrimaryActionIcon = primaryAction === 'stop' ? Square : primaryAction === 'start' ? Play : RefreshCw

  async function handlePrimaryAction() {
    if (primaryAction === 'save') await handleSave(false)
    else await toggleCollecting()
  }

  return (
    <div className="w-96 bg-background text-foreground">
      <AppHeader showSettings />

      <div className="space-y-4 p-4">
        <div>
          <label htmlFor="platform-select" className="mb-2 block text-xs font-medium text-muted-foreground">
            {t('selectPlatform')}
          </label>
          <Select value={platform ?? ''} onValueChange={(value) => setPlatform(value as PlatformId)}>
            <SelectTrigger id="platform-select" className="h-9 w-full">
              <SelectValue placeholder={t('selectPlatform')}>
                {platform && (
                  <span className="flex items-center gap-2">
                    {PlatformIcon && <PlatformIcon className={`h-3.5 w-3.5 shrink-0 ${PLATFORM_ICON_CLASSES[platform]}`} />}
                    <span className="truncate">{platformLabel}</span>
                  </span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {enabledAdapters.map((adapter) => {
                const Icon = PLATFORM_ICONS[adapter.id]
                return (
                  <SelectItem key={adapter.id} value={adapter.id}>
                    <span className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${PLATFORM_ICON_CLASSES[adapter.id]}`} />
                      {adapter.label}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {platform && accountOptions.length > 0 && (
            <div className="mt-3">
              <label htmlFor="account-select" className="mb-2 block text-xs font-medium text-muted-foreground">
                {t('selectAccount')}
              </label>
              <Select value={accountId ?? ''} onValueChange={setAccount}>
                <SelectTrigger id="account-select" className="h-9 w-full">
                  <SelectValue placeholder={t('selectAccount')}>
                    {accountId && <span className="truncate">{formatAccountOption(accountId)}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((id) => (
                    <SelectItem key={id} value={id}>
                      <span className="flex items-center gap-2">
                        <span className="truncate">{formatAccountOption(id)}</span>
                        {id === activeAccountId && <span className="text-xs text-muted-foreground">{t('activePageAccount')}</span>}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeAccountMismatch && <p className="mt-2 text-xs text-warning">{t('accountMismatchHint', { account: activeAccountId })}</p>}
            </div>
          )}
          {platform && accountId && lastSnapshot && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {t('lastScan')}: {formatRelativeTime(lastSnapshot.takenAt, i18n.language)} · {t('scanCount', { count: scanCount ?? 0 })}
            </p>
          )}
        </div>

        {!platform && (
          <div className="flex animate-fade-up flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Compass className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="max-w-[14rem] text-xs text-muted-foreground">{t('noPlatformDetected')}</p>
          </div>
        )}

        {platform && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{t('liveData')}</span>
              {(growing || tabState?.collecting) && (
                <span className="flex items-center gap-2 text-xs font-medium text-primary">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  {tabState?.collecting ? t('autoScrolling') : t('receivingData')}
                </span>
              )}
            </div>
            {!accountId && (
              <p className="mb-2 text-xs text-muted-foreground">{t('noAccountYet')}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Users} value={status?.followers ?? 0} label={t('followersCollected')} tone="default" />
              <StatCard icon={Users} value={status?.following ?? 0} label={t('followingCollected')} tone="default" />
            </div>
            {/* role="status" so the quality verdict (and the completion hint
                below) is announced when it changes — both appear on their own
                while a scan runs, with no interaction to prompt a re-read.
                Deliberately not on the live counters: those tick every ~1.2s
                and would talk over everything else. */}
            {scanQuality && QualityIcon && (
              <div role="status" className={`mt-2 rounded-lg border p-3 shadow-sm ${QUALITY_STYLES[scanQuality.level].card}`}>
                <div className="flex items-start gap-2">
                  <QualityIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium">{t('scanQualityTitle')}</p>
                      <Badge variant={QUALITY_STYLES[scanQuality.level].badge}>{t(`scanQuality_${scanQuality.level}`)}</Badge>
                    </div>
                    {/* Spread, not passed directly: only `complete-with-gap` and
                        `below-expected` interpolate the two counts, and the
                        other reasons simply ignore the extra values. */}
                    <p className="mt-1 text-xs opacity-90">{t(`scanQualityReason_${scanQuality.reason}`, { ...scanQuality.gap })}</p>
                  </div>
                </div>
              </div>
            )}
            {/* Adapters without an automated openList (e.g. GitHub)
                only ever follow whichever list the user has open themselves —
                they don't navigate there on their own. Nudge the user to open
                one before anything can be collected, then — once one side has
                data and the other is still empty — nudge them to open the
                other list too. Adapters that do drive the switch themselves
                (Instagram, X) handle both cases on their own. */}
            {tabState?.collecting && status && platform && !adaptersById[platform]?.openList && (
              <>
                {status.followers === 0 && status.following === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">{t('openAnyListHint')}</p>
                )}
                {(status.followers === 0) !== (status.following === 0) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {status.following === 0 ? t('openFollowingHint') : t('openFollowersHint')}
                  </p>
                )}
              </>
            )}
            {listFullyLoaded && (
              <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {t('listLooksComplete')}
              </p>
            )}
            {!tabState && (
              <p className="mt-2 text-xs text-muted-foreground">
                {tabDiagnostic ? t(`tabDiagnostic_${tabDiagnostic}`) : t('openPlatformTabHint')}
              </p>
            )}

            {accountId && totalCollected > 0 && (
              <div className="mt-1">
                {confirmingReset ? (
                  <div
                    ref={resetConfirmRef}
                    tabIndex={-1}
                    role="alertdialog"
                    aria-describedby="reset-buffer-confirm-text"
                    // Escape backs out, as any dialog should: focus is moved in
                    // here on open, so otherwise the only way out of a
                    // destructive confirmation was tabbing to Cancel.
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setConfirmingReset(false)
                    }}
                    // Same treatment as the dashboard's delete confirmation: the
                    // accent marks the panel, the sentence stays body text so it
                    // is actually readable at 4.5:1.
                    // focus-visible, not focus: this panel is focused
                    // programmatically the moment it appears, and a plain
                    // `focus:` ring drew a heavy 2px outline around the whole
                    // box every single time — reading as a rendering glitch
                    // rather than as a focus indicator. Keyboard users tabbing
                    // in still get the ring.
                    className="space-y-3 rounded-lg border border-warning/40 border-s-2 border-s-warning bg-card p-3 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-warning"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                      <p id="reset-buffer-confirm-text" className="text-xs leading-relaxed text-foreground">
                        {t('resetBufferConfirm')}
                      </p>
                    </div>
                    {/* Natural widths, end-aligned: stretching both to half the
                        popup made the destructive one a ~170px slab of red with
                        the same visual weight as Cancel, which is the opposite
                        of what a destructive confirmation should look like. */}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setConfirmingReset(false)}>
                        {t('cancel')}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={handleResetBuffer} disabled={resetting}>
                        {t('resetBufferConfirmButton')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full gap-2 text-muted-foreground hover:text-destructive"
                    onClick={() => setConfirmingReset(true)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                    {t('resetBuffer')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {saveError && (
          <div className="rounded-lg border border-destructive/40 border-s-2 border-s-destructive bg-card p-3 shadow-sm" role="alert">
            <div className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-xs leading-relaxed text-foreground">{saveError === 'no-data' ? t('saveNoData') : t('saveFailed')}</p>
            </div>
          </div>
        )}

        {warning && (
          <div className="space-y-2 rounded-lg border border-warning/40 border-s-2 border-s-warning bg-card p-3 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed text-foreground">{describeSizeWarning(warning, t)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setWarning(null)}>
                {t('cancel')}
              </Button>
              <Button size="sm" onClick={() => handleSave(true)} disabled={saving}>
                {t('forceSave')}
              </Button>
            </div>
          </div>
        )}

        {diff && (
          <div className="grid grid-cols-3 gap-2">
            <StatCard icon={UserMinus} value={diff.lostFollowers.length} label={t('lostFollowersCount')} tone="destructive" />
            <StatCard icon={UserPlus} value={diff.newFollowers.length} label={t('newFollowersCount')} tone="success" />
            <StatCard icon={UserX} value={diff.notFollowingBack.length} label={t('notFollowingBackCount')} tone="warning" />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant={primaryAction === 'stop' ? 'outline' : 'default'}
            className="min-w-0 flex-1 gap-1.5 px-2 text-xs"
            onClick={handlePrimaryAction}
            disabled={!platform || !accountId || saving || connecting || activeAccountMismatch}
          >
            <PrimaryActionIcon className={`h-3.5 w-3.5 shrink-0 ${saving || connecting ? 'animate-spin' : ''}`} />
            <span className="min-w-0 truncate">{connecting ? t('connecting') : primaryActionLabel}</span>
          </Button>
          <Button variant="outline" className="shrink-0 gap-1.5 px-3 text-xs" onClick={openDashboard}>
            <SquareArrowOutUpRight className="h-3.5 w-3.5 shrink-0" />
            {t('viewAll')}
          </Button>
        </div>

        {/* Credit line, deliberately the quietest thing in the popup: an
            attribution, not an action competing with the scan flow above it. */}
        <DeveloperCredit className="pt-1 text-center" />
      </div>
    </div>
  )
}

export default function Popup() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PopupContent />
      </ToastProvider>
    </ThemeProvider>
  )
}
