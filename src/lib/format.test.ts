import { describe, expect, it } from 'vitest'
import { endOfDayMs, formatRelativeTime, startOfDayMs, toDateInputValue } from './format'

describe('formatRelativeTime', () => {
  it('formats minutes for recent timestamps', () => {
    const text = formatRelativeTime(Date.now() - 5 * 60_000, 'en')
    expect(text).toMatch(/minute/)
  })

  it('formats hours once past the minute range', () => {
    const text = formatRelativeTime(Date.now() - 3 * 3_600_000, 'en')
    expect(text).toMatch(/hour/)
  })

  it('formats days once past the hour range', () => {
    const text = formatRelativeTime(Date.now() - 3 * 86_400_000, 'en')
    expect(text).toMatch(/day/)
  })

  it('formats weeks once past the day range', () => {
    const text = formatRelativeTime(Date.now() - 12 * 86_400_000, 'en')
    expect(text).toMatch(/week/)
  })

  it('formats months once past the week range', () => {
    const text = formatRelativeTime(Date.now() - 45 * 86_400_000, 'en')
    expect(text).toMatch(/month/)
  })

  it('formats years once past the month range', () => {
    const text = formatRelativeTime(Date.now() - 400 * 86_400_000, 'en')
    expect(text).toMatch(/year/)
  })
})

describe('toDateInputValue', () => {
  it('formats a timestamp as YYYY-MM-DD', () => {
    const ms = new Date(2026, 0, 5, 14, 30).getTime() // Jan 5 2026, local time
    expect(toDateInputValue(ms)).toBe('2026-01-05')
  })

  it('zero-pads single-digit months and days', () => {
    const ms = new Date(2026, 2, 3).getTime() // Mar 3 2026
    expect(toDateInputValue(ms)).toBe('2026-03-03')
  })
})

describe('startOfDayMs / endOfDayMs', () => {
  it('startOfDayMs is midnight local time', () => {
    const ms = startOfDayMs('2026-06-15')
    const d = new Date(ms)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([
      2026, 5, 15, 0, 0, 0,
    ])
  })

  it('endOfDayMs is the last millisecond of the day', () => {
    const ms = endOfDayMs('2026-06-15')
    const d = new Date(ms)
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([
      2026, 5, 15, 23, 59, 59,
    ])
  })

  it('endOfDayMs is after startOfDayMs for the same date', () => {
    expect(endOfDayMs('2026-06-15')).toBeGreaterThan(startOfDayMs('2026-06-15'))
  })

  it('falls back to today instead of NaN for malformed input', () => {
    expect(Number.isNaN(startOfDayMs(''))).toBe(false)
    expect(Number.isNaN(endOfDayMs('not-a-date'))).toBe(false)
  })
})
