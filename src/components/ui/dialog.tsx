import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional one-line description, rendered under the title and used as the dialog's `aria-describedby`. */
  description?: string
  children: ReactNode
  footer?: ReactNode
  className?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog, no dependency — same reasoning as the toast (DECISIONS #4): the
 * needs here are a labelled `role="dialog"`, Escape, a backdrop, a focus trap
 * and returning focus where it came from. That is this file; a full dialog
 * library would add far more surface than the four screens using it need.
 *
 * Deliberately not `<dialog>`: its `showModal()` top-layer behavior can't be
 * driven declaratively from React state without imperative open/close calls
 * that then fight the `open` prop.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  // Remembers what was focused before opening, so closing returns the user to
  // the control they opened the dialog from rather than the top of the page.
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    // Focus the first real control, falling back to the panel itself (tabIndex
    // -1) so a dialog whose body is text-only still moves focus inside.
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable ?? panel)?.focus()

    // The page behind a modal must not scroll under it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      previouslyFocused.current?.focus()
    }
  }, [open])

  if (!open) return null

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    // Focus trap: Tab from the last control wraps to the first and vice versa,
    // so keyboard focus can't wander behind the backdrop into a page the user
    // can see but not reach.
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop is a plain div, not a button: clicking it closes, but it must
          not appear in the tab order or be announced as a control. Escape and
          the close button are the accessible paths. */}
      <div className="animate-fade-in absolute inset-0 bg-overlay/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'animate-fade-up relative flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col rounded-lg border border-border bg-card text-card-foreground shadow-lg focus:outline-none',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-sm font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={t('closeDialog')}
            onClick={onClose}
            className="-me-1 -mt-1 shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  )
}
