/**
 * Explicit success/failure envelope used across every context boundary
 * (page ↔ content script ↔ background ↔ popup/dashboard). Raw exceptions
 * never cross a boundary — they're converted to `{ ok: false }` at the edge.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function err<T = never>(error: string): Result<T> {
  return { ok: false, error }
}

export function isResult(value: unknown): value is Result<unknown> {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.ok === true ? 'value' in v : v.ok === false && typeof v.error === 'string'
}
