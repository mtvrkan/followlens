import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, X, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ToastOptions {
  message: string
  tone?: 'success' | 'error'
}

interface ToastItem extends Required<ToastOptions> {
  id: number
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null)

const AUTO_DISMISS_MS = 4000

/**
 * Minimal toast stack (no dependency): bottom-center, auto-dismissing,
 * announced politely to screen readers. Success confirms an action landed;
 * error is how every failed async action becomes visible.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  // Per-toast auto-dismiss timers — held outside React state so hovering one
  // toast to pause it doesn't need to re-render the others.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((current) => current.filter((toastItem) => toastItem.id !== id))
  }, [])

  const scheduleDismiss = useCallback(
    (id: number) => {
      clearTimeout(timers.current.get(id))
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      )
    },
    [dismiss],
  )

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message: options.message, tone: options.tone ?? 'success' }])
      scheduleDismiss(id)
    },
    [scheduleDismiss],
  )

  const region = useMemo(
    () => (
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            // Hovering/focusing a toast pauses its auto-dismiss — otherwise a
            // longer message (e.g. saveFailed) could disappear mid-read with
            // no way to keep it on screen.
            onMouseEnter={() => clearTimeout(timers.current.get(toastItem.id))}
            onMouseLeave={() => scheduleDismiss(toastItem.id)}
            onFocus={() => clearTimeout(timers.current.get(toastItem.id))}
            onBlur={() => scheduleDismiss(toastItem.id)}
            className={cn(
              'pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium shadow-md',
              'toast-enter bg-card text-card-foreground',
              toastItem.tone === 'error' ? 'border-destructive/40' : 'border-border',
            )}
          >
            {toastItem.tone === 'error' ? (
              <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
            )}
            <span>{toastItem.message}</span>
            <button
              type="button"
              aria-label={t('dismissToast')}
              // p-1.5 around a 12px icon is what gets this to the 24×24px
              // minimum target size (WCAG 2.5.8) — it used to be a 16px box.
              // -me-1.5 pulls the added padding back out of the toast's own
              // inline padding, keeping the visual gap unchanged; logical, so
              // it stays on the correct side under dir="rtl".
              className="-me-1.5 shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => dismiss(toastItem.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    ),
    [toasts, dismiss, scheduleDismiss, t],
  )

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {region}
    </ToastContext.Provider>
  )
}

export function useToast(): (options: ToastOptions) => void {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used within a ToastProvider')
  return toast
}
