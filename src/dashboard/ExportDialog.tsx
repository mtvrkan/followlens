import { useTranslation } from 'react-i18next'
import { Download, FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Dialog } from '../components/ui/dialog'
import { ExportFormatPicker, type FormatOption } from './ExportFormatPicker'
import {
  EXPORT_COLUMNS,
  toggleExportColumn,
  type ExportColumn,
  type ExportFormat,
  type ExportPreset,
} from '../lib/export-view'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  preset: ExportPreset
  onPresetChange: (preset: ExportPreset) => void
  columns: ExportColumn[]
  onColumnsChange: (columns: ExportColumn[]) => void
  /** How many rows the current format+preset combination would write. */
  rowCount: number
  snapshotCount: number
  onExport: () => void
}

const FORMATS: FormatOption[] = [
  { value: 'csv', labelKey: 'exportFormatCsv', icon: FileSpreadsheet, descKey: 'exportFormatCsvDesc' },
  { value: 'json', labelKey: 'exportFormatJson', icon: FileJson, descKey: 'exportFormatJsonDesc' },
  { value: 'html', labelKey: 'exportFormatHtml', icon: FileText, descKey: 'exportFormatHtmlDesc' },
  { value: 'pdf', labelKey: 'exportFormatPdf', icon: Printer, descKey: 'exportFormatPdfDesc' },
]

const PRESETS: { value: ExportPreset; labelKey: string }[] = [
  { value: 'current', labelKey: 'exportPresetCurrent' },
  { value: 'allFollowers', labelKey: 'exportPresetAllFollowers' },
  { value: 'allFollowing', labelKey: 'exportPresetAllFollowing' },
  { value: 'notFollowingBack', labelKey: 'exportPresetNotFollowingBack' },
  { value: 'lostFollowers', labelKey: 'exportPresetLostFollowers' },
]

/**
 * One dialog in place of the three export buttons, the preset dropdown and the
 * column dropdown that used to sit in the list's toolbar (the column one was a
 * Radix Select stuffed with checkboxes, which never worked as a menu). Choices
 * that only apply to one format are disabled rather than hidden, so the shape of
 * the dialog doesn't jump around as the format changes.
 */
export function ExportDialog({
  open,
  onClose,
  format,
  onFormatChange,
  preset,
  onPresetChange,
  columns,
  onColumnsChange,
  rowCount,
  snapshotCount,
  onExport,
}: ExportDialogProps) {
  const { t } = useTranslation()

  // CSV is the only row-and-column format: JSON exports the raw scan history and
  // the report formats render a fixed layout, so none of them takes a column
  // selection.
  const usesRowSelection = format === 'csv' || format === 'html' || format === 'pdf'
  const usesColumns = format === 'csv'
  const exportDisabled = format === 'json' ? snapshotCount === 0 : rowCount === 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('exportDialogTitle')}
      description={t('exportDialogDesc')}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button size="sm" className="gap-2" onClick={onExport} disabled={exportDisabled}>
            <Download className="h-3.5 w-3.5 shrink-0" />
            {t('exportRunButton')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ExportFormatPicker options={FORMATS} value={format} onChange={onFormatChange} />

        <fieldset disabled={!usesRowSelection} className="disabled:opacity-50">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t('exportPreset')}</legend>
          <div className="space-y-1">
            {PRESETS.map(({ value, labelKey }) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted has-[:disabled]:cursor-default"
              >
                <input
                  type="radio"
                  name="export-preset"
                  value={value}
                  checked={preset === value}
                  disabled={!usesRowSelection}
                  onChange={() => onPresetChange(value)}
                  className="h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
                <span>{t(labelKey)}</span>
              </label>
            ))}
          </div>
          {!usesRowSelection && <p className="mt-2 text-2xs text-muted-foreground">{t('exportJsonScopeHint')}</p>}
        </fieldset>

        <fieldset disabled={!usesColumns} className="disabled:opacity-50">
          <legend className="mb-2 text-xs font-medium text-muted-foreground">{t('exportColumns')}</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((column) => (
              <label key={column} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                <Checkbox
                  checked={columns.includes(column)}
                  disabled={!usesColumns}
                  onCheckedChange={(checked) => onColumnsChange(toggleExportColumn(columns, column, checked === true))}
                />
                <span>{t(`exportColumn_${column}`)}</span>
              </label>
            ))}
          </div>
          {!usesColumns && <p className="mt-2 text-2xs text-muted-foreground">{t('exportColumnsFormatHint')}</p>}
        </fieldset>

        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {format === 'json'
            ? t('exportSummaryScans', { count: snapshotCount })
            : t('exportSummaryRows', { count: rowCount })}
          {/* PDF is the one format that does not just drop a file in Downloads —
              say so before the print dialog appears out of nowhere. */}
          {format === 'pdf' && <span className="mt-1 block">{t('exportPdfHint')}</span>}
        </p>
      </div>
    </Dialog>
  )
}
