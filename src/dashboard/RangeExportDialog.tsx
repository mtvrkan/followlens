import { useTranslation } from 'react-i18next'
import { Download, FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { ExportFormatPicker, type FormatOption } from './ExportFormatPicker'
import type { ExportFormat } from '../lib/export-view'

interface RangeExportDialogProps {
  open: boolean
  onClose: () => void
  format: ExportFormat
  onFormatChange: (format: ExportFormat) => void
  /** Scans inside the selected date range — everything here exports exactly those. */
  scanCount: number
  onExport: () => void
}

const FORMATS: FormatOption[] = [
  { value: 'csv', labelKey: 'exportFormatCsv', icon: FileSpreadsheet, descKey: 'exportRangeCsvDesc' },
  { value: 'json', labelKey: 'exportFormatJson', icon: FileJson, descKey: 'exportRangeJsonDesc' },
  { value: 'html', labelKey: 'exportFormatHtml', icon: FileText, descKey: 'exportRangeReportDesc' },
  { value: 'pdf', labelKey: 'exportFormatPdf', icon: Printer, descKey: 'exportFormatPdfDesc' },
]

/**
 * The analytics counterpart to `ExportDialog`. It carries no preset or column
 * choice because the date range above it already is the selection — every
 * format here writes the same set of scans, differing only in shape.
 */
export function RangeExportDialog({ open, onClose, format, onFormatChange, scanCount, onExport }: RangeExportDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('exportDialogTitle')}
      description={t('exportRangeDialogDesc')}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button size="sm" className="gap-2" onClick={onExport} disabled={scanCount === 0}>
            <Download className="h-3.5 w-3.5 shrink-0" />
            {t('exportRunButton')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ExportFormatPicker options={FORMATS} value={format} onChange={onFormatChange} />

        <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          {t('exportSummaryRangeScans', { count: scanCount })}
          {format === 'pdf' && <span className="mt-1 block">{t('exportPdfHint')}</span>}
        </p>
      </div>
    </Dialog>
  )
}
