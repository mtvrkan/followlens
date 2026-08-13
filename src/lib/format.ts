export function formatRelativeTime(timestamp: number, locale: string): string {
  const diffMinutes = Math.round((timestamp - Date.now()) / 60_000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 7) return rtf.format(diffDays, 'day')
  const diffWeeks = Math.round(diffDays / 7)
  if (Math.abs(diffWeeks) < 5) return rtf.format(diffWeeks, 'week')
  const diffMonths = Math.round(diffDays / 30)
  if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month')
  return rtf.format(Math.round(diffDays / 365), 'year')
}

/** Formats a timestamp as a local-time `YYYY-MM-DD` string, e.g. for `<input type="date">` values. */
export function toDateInputValue(ms: number): string {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/

/** Start-of-day (local time) in ms for a `YYYY-MM-DD` date-input value. */
export function startOfDayMs(dateInputValue: string): number {
  // <input type="date"> can report '' (cleared, or mid-typing) while still
  // controlled — falling through to `new Date('T00:00:00')` would silently
  // produce NaN, which then makes every numeric range comparison downstream
  // false rather than surfacing anything. Today is a safe, visible fallback.
  if (!DATE_INPUT_RE.test(dateInputValue)) return startOfDayMs(toDateInputValue(Date.now()))
  return new Date(`${dateInputValue}T00:00:00`).getTime()
}

/** End-of-day (local time) in ms for a `YYYY-MM-DD` date-input value. */
export function endOfDayMs(dateInputValue: string): number {
  if (!DATE_INPUT_RE.test(dateInputValue)) return endOfDayMs(toDateInputValue(Date.now()))
  return new Date(`${dateInputValue}T23:59:59.999`).getTime()
}
