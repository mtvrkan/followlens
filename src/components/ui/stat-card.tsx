import { useEffect, useRef, useState, type ComponentType } from 'react'

export type StatTone = 'default' | 'destructive' | 'success' | 'warning'

const TONE_ICON_CLASSES: Record<StatTone, string> = {
  default: 'bg-primary/10 text-primary',
  destructive: 'bg-destructive/10 text-destructive',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
}

// Only destructive/warning get a tinted card surface — those are the counts
// worth drawing the eye to (lost followers, not-following-back). Default/
// success stay neutral so they don't compete with the ones that matter more.
const TONE_CARD_CLASSES: Record<StatTone, string> = {
  default: 'border-border bg-card',
  success: 'border-border bg-card',
  destructive: 'border-destructive/25 bg-destructive/[0.03]',
  warning: 'border-warning/25 bg-warning/[0.03]',
}

/** Animates numeric changes instead of snapping — skipped under prefers-reduced-motion. */
function useCountUp(value: number, durationMs = 500): number {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const raf = requestAnimationFrame(() => {
        fromRef.current = value
        setDisplay(value)
      })
      return () => cancelAnimationFrame(raf)
    }

    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - (1 - progress) ** 3
      const next = Math.round(from + (value - from) * eased)
      fromRef.current = next
      setDisplay(next)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, durationMs])

  return display
}

export function StatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: ComponentType<{ className?: string }>
  value: number
  label: string
  tone: StatTone
}) {
  const displayValue = useCountUp(value)

  return (
    <div
      className={`group flex flex-col gap-2 rounded-lg border p-3 shadow-sm transition-all duration-200 ease-emphasized hover:-translate-y-0.5 hover:shadow-md ${TONE_CARD_CLASSES[tone]}`}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-transform duration-200 ease-emphasized group-hover:scale-110 ${TONE_ICON_CLASSES[tone]}`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="text-2xl font-semibold leading-none tabular-nums">{displayValue}</p>
      <p className="text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  )
}
