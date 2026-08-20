import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, History, Trash2, TriangleAlert, X } from 'lucide-react'
import { formatRelativeTime } from '../lib/format'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { DeveloperCredit } from '../components/developer-credit'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { FilterCheckboxes } from './FilterCheckboxes'
import { PLATFORM_ICON_CLASSES, PLATFORM_ICONS } from '../lib/platform-meta'
import { adapters, enabledAdapters } from '../platforms/registry'
import type { FilterKey } from '../lib/rows'
import type { PlatformId, Snapshot } from '../lib/types'

interface SidebarProps {
  platform: PlatformId | null
  onPlatformChange: (platform: PlatformId) => void
  knownAccountIds: string[]
  selectedAccountId: string | null
  onAccountChange: (accountId: string) => void
  accountLabel: (id: string) => string
  snapshots: Snapshot[] | undefined
  selectedScanIndex: number | null
  onScanIndexChange: (index: number) => void
  viewingLatest: boolean
  confirmingDelete: boolean
  onConfirmingDeleteChange: (confirming: boolean) => void
  deleting: boolean
  onDeleteAccount: () => void
  deletingSnapshotId: number | null
  onDeleteSnapshot: (snapshotId: number) => void
  showFilters: boolean
  filters: Record<FilterKey, boolean>
  onFiltersChange: (filters: Record<FilterKey, boolean>) => void
  filterCounts: Record<FilterKey, number>
}

/** Dashboard's left rail: platform/account pickers, scan history, account deletion, list filters. */
export function Sidebar(props: SidebarProps) {
  const { t, i18n } = useTranslation()
  const {
    platform,
    onPlatformChange,
    knownAccountIds,
    selectedAccountId,
    onAccountChange,
    accountLabel,
    snapshots,
    selectedScanIndex,
    onScanIndexChange,
    viewingLatest,
    confirmingDelete,
    onConfirmingDeleteChange,
    deleting,
    onDeleteAccount,
    deletingSnapshotId,
    onDeleteSnapshot,
    showFilters,
    filters,
    onFiltersChange,
    filterCounts,
  } = props

  const PlatformIcon = platform ? PLATFORM_ICONS[platform] : null
  const platformLabel = platform ? adapters.find((adapter) => adapter.id === platform)?.label : null

  // Which scan-history row is showing its inline "delete this scan?" confirm
  // — local UI state (not lifted like confirmingDelete) since it's purely
  // about which row is expanded, not something Dashboard needs to react to.
  const [confirmingSnapshotId, setConfirmingSnapshotId] = useState<number | null>(null)

  // Moves focus into the confirm panel when it appears — otherwise keyboard
  // and screen-reader users get no signal that a destructive confirmation
  // step just replaced the button they were on.
  const deleteConfirmRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (confirmingDelete) deleteConfirmRef.current?.focus()
  }, [confirmingDelete])

  return (
    <aside className="w-64 shrink-0 space-y-4 border-e border-border p-4">
      <div>
        <label htmlFor="dashboard-platform-select" className="mb-2 block text-xs font-medium text-muted-foreground">
          {t('selectPlatform')}
        </label>
        <Select value={platform ?? ''} onValueChange={(value) => onPlatformChange(value as PlatformId)}>
          <SelectTrigger id="dashboard-platform-select" className="h-9 w-full">
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
      </div>

      {platform && knownAccountIds.length > 0 && (
        <div>
          <label htmlFor="dashboard-account-select" className="mb-2 block text-xs font-medium text-muted-foreground">
            {t('selectAccount')}
          </label>
          <Select
            value={selectedAccountId ?? ''}
            onValueChange={(value) => {
              onAccountChange(value)
              onConfirmingDeleteChange(false)
            }}
          >
            <SelectTrigger id="dashboard-account-select" className="h-9 w-full">
              <SelectValue placeholder={t('selectAccount')}>
                {selectedAccountId && <span className="truncate">{accountLabel(selectedAccountId)}</span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {knownAccountIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {accountLabel(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {knownAccountIds.length > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">{t('multiAccountHint', { count: knownAccountIds.length })}</p>
          )}
        </div>
      )}

      {snapshots && snapshots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              {t('scanHistory')}
            </h2>
            {!viewingLatest && (
              <button
                type="button"
                className="rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => onScanIndexChange(snapshots.length - 1)}
              >
                {t('backToLatest')}
              </button>
            )}
          </div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-sm">
            {[...snapshots].reverse().map((snap, reversedIndex) => {
              const index = snapshots.length - 1 - reversedIndex
              const isSelected = index === selectedScanIndex
              const id = snap.id as number
              const confirming = confirmingSnapshotId === id
              return (
                <div
                  key={id}
                  className={cn(
                    'flex items-center gap-1 rounded-md text-xs transition-colors',
                    isSelected && !confirming ? 'bg-primary/10 font-medium text-primary' : undefined,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onScanIndexChange(index)}
                    className={cn(
                      'flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      !isSelected && 'hover:bg-muted',
                    )}
                  >
                    <span className="truncate">{formatRelativeTime(snap.takenAt, i18n.language)}</span>
                    <span className="ms-2 shrink-0 text-xs text-muted-foreground">
                      {snap.followers.length}/{snap.following.length}
                    </span>
                  </button>
                  {confirming ? (
                    <div className="flex shrink-0 items-center gap-1 pe-1">
                      <button
                        type="button"
                        aria-label={t('cancel')}
                        onClick={() => setConfirmingSnapshotId(null)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t('deleteSnapshotConfirmButton')}
                        disabled={deletingSnapshotId === id}
                        onClick={() => {
                          onDeleteSnapshot(id)
                          setConfirmingSnapshotId(null)
                        }}
                        className="rounded p-1.5 text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={t('deleteSnapshot')}
                      onClick={() => setConfirmingSnapshotId(id)}
                      className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('scanCount', { count: snapshots.length })}</p>
        </div>
      )}

      {platform && selectedAccountId && (
        <div>
          {confirmingDelete ? (
            <div
              ref={deleteConfirmRef}
              tabIndex={-1}
              role="alertdialog"
              aria-describedby="delete-account-confirm-text"
              // Escape backs out of a destructive confirmation, the way every
              // dialog is expected to: focus is moved in here on open, so
              // without it a keyboard user had to Tab to Cancel to escape.
              onKeyDown={(event) => {
                if (event.key === 'Escape') onConfirmingDeleteChange(false)
              }}
              // Neutral card surface with a destructive accent, not a red block:
              // the warning text used to be `text-destructive` on a red tint,
              // which both sat below the 4.5:1 contrast floor for body text and
              // shouted loudly enough that the two buttons under it stopped
              // reading as a choice. The colour now marks the panel (start
              // border, icon, confirm button); the sentence itself is body text.
              // focus-visible, not focus: the panel takes focus programmatically as soon
              // as it appears, and a plain `focus:` ring outlined the whole box every
              // time it opened.
              className="space-y-3 rounded-lg border border-destructive/40 border-s-2 border-s-destructive bg-card p-3 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <p id="delete-account-confirm-text" className="text-xs leading-relaxed text-foreground">
                  {t('deleteAccountConfirm')}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => onConfirmingDeleteChange(false)}>
                  {t('cancel')}
                </Button>
                <Button size="sm" variant="destructive" onClick={onDeleteAccount} disabled={deleting}>
                  {t('deleteAccountConfirmButton')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2 text-destructive hover:bg-destructive/10"
              onClick={() => onConfirmingDeleteChange(true)}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              {t('deleteAccount')}
            </Button>
          )}
        </div>
      )}

      {/* Only relevant to the follower-list tab — hidden on Analytics so its
          own, differently-scoped filter counts (e.g. in Compare) aren't
          shown side-by-side with these and confused for the same thing. */}
      {showFilters && <FilterCheckboxes title={t('filters')} filters={filters} onFiltersChange={onFiltersChange} counts={filterCounts} />}

      {/* Pushed to the foot of the rail by the border above it, so it reads as a
          sign-off rather than another control in the filter stack. */}
      <DeveloperCredit className="border-t border-border pt-4 text-center" />
    </aside>
  )
}
