import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bug, Database, Download, HardDrive, Languages, Palette, Radio, Scissors, ShieldCheck, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { DEBUG_LOGGING_KEY } from '../shared/debug'
import { DeveloperCredit } from '../components/developer-credit'
import { isSelfFetchAllowed, listSelfFetchCooldownKeys, SELF_FETCH_KEY } from '../shared/settings'
import { db } from '../lib/db'
import { downloadFile } from '../lib/export'
import { importBackup, parseBackupJson } from '../lib/backup'
import { buildDataIntegrityReport, hasIntegrityIssues, type DataIntegrityReport } from '../lib/integrity'
import {
  applySnapshotRetention,
  buildStorageUsageReport,
  formatBytes,
  type StorageUsageReport,
} from '../lib/storage-maintenance'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'
import { ThemeProvider, useTheme } from '../components/theme-provider'
import { AppHeader } from '../components/app-header'
import { ToastProvider, useToast } from '../components/ui/toast'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import type { ReactNode } from 'react'
import '../lib/i18n'
import '../styles/globals.css'

function SettingRow({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">{icon}</div>
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function OptionsContent() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const [debugLogging, setDebugLogging] = useState(false)
  const [selfFetch, setSelfFetch] = useState(true)
  const [confirmingWipe, setConfirmingWipe] = useState(false)
  const [confirmingRetention, setConfirmingRetention] = useState(false)
  const [busy, setBusy] = useState(false)
  const [integrityReport, setIntegrityReport] = useState<DataIntegrityReport | null>(null)
  const [storageReport, setStorageReport] = useState<StorageUsageReport | null>(null)
  const [retentionKeep, setRetentionKeep] = useState(25)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Reflects whatever is stored rather than assuming off: the flag survives
  // across sessions, so the switch has to show the real current state.
  useEffect(() => {
    let cancelled = false
    // Both .catch()es keep an unreachable storage (invalidated context) from
    // becoming an unhandled rejection; the switches then just show their
    // documented defaults.
    chrome.storage.local
      .get(DEBUG_LOGGING_KEY)
      .then((stored) => {
        if (!cancelled) setDebugLogging(stored?.[DEBUG_LOGGING_KEY] === true)
      })
      .catch(() => undefined)
    isSelfFetchAllowed()
      .then((allowed) => {
        if (!cancelled) setSelfFetch(allowed)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleSelfFetch(next: boolean) {
    setSelfFetch(next)
    try {
      await chrome.storage.local.set({ [SELF_FETCH_KEY]: next })
    } catch {
      setSelfFetch(!next)
      toast({ message: t('settingSaveFailed'), tone: 'error' })
    }
  }

  async function toggleDebugLogging(next: boolean) {
    setDebugLogging(next)
    try {
      await chrome.storage.local.set({ [DEBUG_LOGGING_KEY]: next })
    } catch {
      setDebugLogging(!next)
      toast({ message: t('settingSaveFailed'), tone: 'error' })
    }
  }

  async function exportAllData() {
    setBusy(true)
    try {
      const snapshots = await db.snapshots.orderBy('takenAt').toArray()
      const { accountLabels } = await chrome.storage.local.get('accountLabels')
      downloadFile(
        'followlens-backup.json',
        JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), accountLabels: accountLabels ?? {}, snapshots }, null, 2),
        'application/json',
      )
    } catch {
      toast({ message: t('exportAllFailed'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function importBackupFile(file: File) {
    setBusy(true)
    try {
      const parsed = parseBackupJson(await file.text())
      if (!parsed.ok) {
        toast({ message: t('importBackupInvalid'), tone: 'error' })
        return
      }
      const result = await importBackup(
        parsed.value,
        { snapshots: db.snapshots, accountSummaries: db.accountSummaries },
        chrome.storage.local,
      )
      toast({
        message: t('importBackupDone', {
          imported: result.importedSnapshots,
          skipped: result.skippedSnapshots,
          labels: result.restoredLabels,
        }),
      })
    } catch {
      toast({ message: t('importBackupFailed'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function wipeAllData() {
    setBusy(true)
    try {
      await db.snapshots.clear()
      await db.bufferUsers.clear()
      await db.accountSummaries.clear()
      // `ignoredUsers` is user-authored data and `expectedCounts` is live scan
      // state keyed by account — both used to survive a "delete everything",
      // so a later re-scan of the same account silently inherited an invisible
      // ignore list and a stale expected-count target to be judged against.
      // The self-fetch cooldown timestamps are the same class of leftover:
      // transient per-platform scan state, not a setting, and one surviving a
      // wipe meant the next scans quietly ran on the slower DOM-only path for
      // up to three hours with nothing in the UI saying why. The two real
      // settings (self-fetch on/off, debug logging) are deliberately NOT
      // cleared — this button deletes collected data, not the user's choices.
      await chrome.storage.local.remove([
        'lastAccounts',
        'lastPlatform',
        'accountLabels',
        'ignoredUsers',
        'expectedCounts',
        ...(await listSelfFetchCooldownKeys()),
      ])
      setConfirmingWipe(false)
      toast({ message: t('wipeAllDone') })
    } catch {
      toast({ message: t('wipeAllFailed'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function checkDataIntegrity() {
    setBusy(true)
    try {
      const report = await buildDataIntegrityReport()
      setIntegrityReport(report)
      toast({ message: hasIntegrityIssues(report) ? t('integrityIssuesFound') : t('integrityLooksGood') })
    } catch {
      toast({ message: t('integrityCheckFailed'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function refreshStorageUsage() {
    setBusy(true)
    try {
      setStorageReport(await buildStorageUsageReport())
      toast({ message: t('storageUsageUpdated') })
    } catch {
      toast({ message: t('storageUsageFailed'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function runSnapshotRetention() {
    setBusy(true)
    try {
      const result = await applySnapshotRetention(retentionKeep)
      setStorageReport(await buildStorageUsageReport())
      setConfirmingRetention(false)
      toast({ message: t('retentionApplied', { deleted: result.deletedSnapshots, kept: result.keptSnapshots }) })
    } catch {
      toast({ message: t('retentionFailed'), tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader className="px-6" />
      <main className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="text-base font-semibold">{t('settingsTitle')}</h1>

        <SettingRow icon={<Languages className="h-4 w-4" />} title={t('settingLanguage')} description={t('settingLanguageDesc')}>
          <Select value={i18n.resolvedLanguage ?? ''} onValueChange={(value) => i18n.changeLanguage(value)}>
            <SelectTrigger className="h-9 w-36" aria-label={t('changeLanguage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow icon={<Palette className="h-4 w-4" />} title={t('settingTheme')} description={t('settingThemeDesc')}>
          <Select value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}>
            <SelectTrigger className="h-9 w-36" aria-label={t('settingTheme')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('themeSystem')}</SelectItem>
              <SelectItem value="light">{t('themeLight')}</SelectItem>
              <SelectItem value="dark">{t('themeDark')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow icon={<Download className="h-4 w-4" />} title={t('settingExportAll')} description={t('settingExportAllDesc')}>
          <Button size="sm" variant="outline" className="gap-2" onClick={exportAllData} disabled={busy}>
            <Download className="h-3.5 w-3.5 shrink-0" />
            {t('exportAllButton')}
          </Button>
        </SettingRow>

        <SettingRow icon={<Upload className="h-4 w-4" />} title={t('settingImportBackup')} description={t('settingImportBackupDesc')}>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void importBackupFile(file)
            }}
          />
          <Button size="sm" variant="outline" className="gap-2" onClick={() => importInputRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5 shrink-0" />
            {t('importBackupButton')}
          </Button>
        </SettingRow>

        <SettingRow icon={<Database className="h-4 w-4" />} title={t('settingIntegrityCheck')} description={t('settingIntegrityCheckDesc')}>
          <Button size="sm" variant="outline" className="gap-2" onClick={checkDataIntegrity} disabled={busy}>
            <Database className="h-3.5 w-3.5 shrink-0" />
            {t('integrityCheckButton')}
          </Button>
        </SettingRow>

        {integrityReport && (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{t('integrityReportTitle')}</h2>
              <span className={hasIntegrityIssues(integrityReport) ? 'text-xs font-medium text-warning' : 'text-xs font-medium text-success'}>
                {hasIntegrityIssues(integrityReport) ? t('integrityReportNeedsReview') : t('integrityReportClean')}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('integritySnapshots')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{integrityReport.snapshots}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('integrityDuplicates')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{integrityReport.duplicateSnapshots}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('integrityInvalid')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{integrityReport.invalidSnapshots}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('integrityStaleSummaries')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{integrityReport.staleAccountSummaries}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('integrityMissingSummaries')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{integrityReport.missingAccountSummaries}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('integrityOrphanedBuffers')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{integrityReport.orphanedBufferRows}</dd>
              </div>
            </dl>
          </div>
        )}

        <SettingRow icon={<HardDrive className="h-4 w-4" />} title={t('settingStorageUsage')} description={t('settingStorageUsageDesc')}>
          <Button size="sm" variant="outline" className="gap-2" onClick={refreshStorageUsage} disabled={busy}>
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
            {t('refreshStorageUsage')}
          </Button>
        </SettingRow>

        {storageReport && (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">{t('storageUsageTitle')}</h2>
              <span className="text-xs font-medium tabular-nums text-primary">{formatBytes(storageReport.totalBytes)}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('storageUsageSnapshots')}</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {storageReport.snapshots} / {formatBytes(storageReport.snapshotBytes)}
                </dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('storageUsageBuffers')}</dt>
                <dd className="mt-1 font-medium tabular-nums">
                  {storageReport.bufferRows} / {formatBytes(storageReport.bufferBytes)}
                </dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('storageUsageAccounts')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{storageReport.accounts}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('storageUsageLocal')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{formatBytes(storageReport.localBytes)}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-2">
                <dt className="text-muted-foreground">{t('storageUsageTotal')}</dt>
                <dd className="mt-1 font-medium tabular-nums">{formatBytes(storageReport.totalBytes)}</dd>
              </div>
            </dl>
          </div>
        )}

        <SettingRow icon={<Scissors className="h-4 w-4" />} title={t('settingRetention')} description={t('settingRetentionDesc')}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{t('retentionKeepLabel')}</span>
              <input
                type="number"
                min={1}
                max={500}
                value={retentionKeep}
                onChange={(event) => setRetentionKeep(Math.max(1, Math.min(500, Number(event.target.value) || 1)))}
                className="h-9 w-20 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            {confirmingRetention ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setConfirmingRetention(false)}>
                  {t('cancel')}
                </Button>
                <Button size="sm" variant="destructive" onClick={runSnapshotRetention} disabled={busy}>
                  {t('retentionConfirmButton')}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setConfirmingRetention(true)} disabled={busy}>
                <Scissors className="h-3.5 w-3.5 shrink-0" />
                {t('applyRetention')}
              </Button>
            )}
          </div>
        </SettingRow>

        {confirmingRetention && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 border-s-2 border-s-warning bg-card p-3 shadow-sm">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <p className="text-xs leading-relaxed text-foreground">{t('retentionConfirm')}</p>
          </div>
        )}

        <SettingRow icon={<Trash2 className="h-4 w-4" />} title={t('settingWipeAll')} description={t('settingWipeAllDesc')}>
          {confirmingWipe ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setConfirmingWipe(false)}>
                {t('cancel')}
              </Button>
              <Button size="sm" variant="destructive" onClick={wipeAllData} disabled={busy}>
                {t('wipeAllConfirmButton')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="gap-2 text-destructive hover:bg-destructive/10" onClick={() => setConfirmingWipe(true)}>
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              {t('wipeAllButton')}
            </Button>
          )}
        </SettingRow>

        {/* The one setting that changes what the extension is allowed to
            request rather than how it displays things — hence the plain-language
            description of the trade-off, not just an on/off label. */}
        <SettingRow icon={<Radio className="h-4 w-4" />} title={t('settingSelfFetch')} description={t('settingSelfFetchDesc')}>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={selfFetch} onCheckedChange={(checked) => void toggleSelfFetch(checked === true)} />
            <span>{selfFetch ? t('selfFetchOn') : t('selfFetchOff')}</span>
          </label>
        </SettingRow>

        {/* Last, and deliberately plain: this is a diagnostic aid, not a
            feature — it only decides whether the collection path prints to the
            page console (off by default, see shared/debug.ts). */}
        <SettingRow icon={<Bug className="h-4 w-4" />} title={t('settingDebugLogging')} description={t('settingDebugLoggingDesc')}>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={debugLogging} onCheckedChange={(checked) => void toggleDebugLogging(checked === true)} />
            <span>{debugLogging ? t('debugLoggingOn') : t('debugLoggingOff')}</span>
          </label>
        </SettingRow>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          <p className="text-xs text-muted-foreground">{t('privacyNote')}</p>
        </div>

        {/* The only developer mention on this page. There used to be a
            "Developer" settings row above it linking to the same place, which
            made the page state it twice and dressed a credit up as a setting. */}
        <DeveloperCredit className="pt-2 text-center" />
      </main>
    </div>
  )
}

export default function Options() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <OptionsContent />
      </ToastProvider>
    </ThemeProvider>
  )
}
