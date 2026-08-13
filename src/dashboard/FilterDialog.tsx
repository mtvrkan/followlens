import { useTranslation } from 'react-i18next'
import { BadgeCheck, EyeOff, Lock, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { NO_ATTRIBUTE_FILTERS, type AttributeFilters, type AttributeMatch } from '../lib/rows'

interface FilterDialogProps {
  open: boolean
  onClose: () => void
  filters: AttributeFilters
  onFiltersChange: (filters: AttributeFilters) => void
  showIgnored: boolean
  onShowIgnoredChange: (showIgnored: boolean) => void
  ignoredCount: number
  /** How many rows carry each attribute, before narrowing — shown so an option that can only empty the list is visibly a dead end. */
  counts: { verified: number; private: number }
}

const MATCH_OPTIONS: AttributeMatch[] = ['any', 'only', 'exclude']

/**
 * All the list-narrowing choices behind one button. Previously each attribute
 * was its own toggle chip in the toolbar, which (a) could only express "only
 * these", never "everything except these", and (b) pushed the toolbar into
 * overflow as soon as two of them appeared next to Privacy and Export.
 *
 * Changes apply immediately — the list behind the dialog updates as options are
 * picked, so there is no Apply button to forget to press.
 */
export function FilterDialog({
  open,
  onClose,
  filters,
  onFiltersChange,
  showIgnored,
  onShowIgnoredChange,
  ignoredCount,
  counts,
}: FilterDialogProps) {
  const { t } = useTranslation()

  const groups: {
    key: keyof AttributeFilters
    titleKey: string
    icon: typeof BadgeCheck
    count: number
    labelKeys: Record<AttributeMatch, string>
  }[] = [
    {
      key: 'verified',
      titleKey: 'filterVerifiedGroup',
      icon: BadgeCheck,
      count: counts.verified,
      labelKeys: { any: 'filterMatchAny', only: 'filterOnlyVerified', exclude: 'filterExcludeVerified' },
    },
    {
      key: 'private',
      titleKey: 'filterPrivateGroup',
      icon: Lock,
      count: counts.private,
      labelKeys: { any: 'filterMatchAny', only: 'filterOnlyPrivate', exclude: 'filterExcludePrivate' },
    },
  ]

  const isDefault = filters.verified === 'any' && filters.private === 'any' && !showIgnored

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('filterDialogTitle')}
      description={t('filterDialogDesc')}
      className="max-w-md"
      footer={
        <>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isDefault}
            onClick={() => {
              onFiltersChange(NO_ATTRIBUTE_FILTERS)
              onShowIgnoredChange(false)
            }}
          >
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            {t('clearFilters')}
          </Button>
          <Button size="sm" onClick={onClose}>
            {t('closeDialog')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {groups.map(({ key, titleKey, icon: Icon, count, labelKeys }) => (
          <fieldset key={key}>
            <legend className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {t(titleKey)}
              <span className="tabular-nums opacity-70">{count}</span>
            </legend>
            <div className="space-y-1">
              {MATCH_OPTIONS.map((match) => (
                <label
                  key={match}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="radio"
                    name={`filter-${key}`}
                    value={match}
                    checked={filters[key] === match}
                    onChange={() => onFiltersChange({ ...filters, [key]: match })}
                    className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <span>{t(labelKeys[match])}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        {/* Ignored rows were a separate toolbar toggle; it belongs with the other
            "what does the list contain" choices, and only exists at all once
            something has actually been ignored. */}
        {ignoredCount > 0 && (
          <fieldset>
            <legend className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <EyeOff className="h-3.5 w-3.5 shrink-0" />
              {t('filterIgnoredGroup')}
              <span className="tabular-nums opacity-70">{ignoredCount}</span>
            </legend>
            <div className="space-y-1">
              {[false, true].map((value) => (
                <label
                  key={String(value)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="radio"
                    name="filter-ignored"
                    checked={showIgnored === value}
                    onChange={() => onShowIgnoredChange(value)}
                    className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <span>{value ? t('filterIgnoredShow') : t('filterIgnoredHide')}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>
    </Dialog>
  )
}
