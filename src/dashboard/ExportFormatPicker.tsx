import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import type { ExportFormat } from '../lib/export-view'

export interface FormatOption {
  value: ExportFormat
  labelKey: string
  descKey: string
  icon: LucideIcon
}

interface ExportFormatPickerProps {
  options: FormatOption[]
  value: ExportFormat
  onChange: (format: ExportFormat) => void
}

/**
 * Shared by both export dialogs so the two can never drift apart visually.
 *
 * Two columns with the icon beside the text, not four columns with the icon
 * stacked above it: the dialog is `max-w-lg`, so four cards left each
 * description about 100px to wrap in and every one of them ran to four lines.
 * Halving the count and moving the icon out of the text column roughly triples
 * the room a description gets.
 */
export function ExportFormatPicker({ options, value, onChange }: ExportFormatPickerProps) {
  const { t } = useTranslation()

  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{t('exportFormat')}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(({ value: option, labelKey, descKey, icon: Icon }) => {
          const selected = value === option
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:bg-muted'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-medium ${selected ? 'text-primary' : undefined}`}>{t(labelKey)}</span>
                <span className="mt-0.5 block text-2xs leading-snug text-muted-foreground">{t(descKey)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
