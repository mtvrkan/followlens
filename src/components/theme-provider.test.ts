import { describe, expect, it } from 'vitest'
import { readStoredTheme, resolveTheme } from './theme-provider'

function storage(value: string | null): Pick<Storage, 'getItem'> {
  return { getItem: () => value }
}

describe('readStoredTheme', () => {
  it('returns a valid stored choice', () => {
    expect(readStoredTheme(storage('dark'))).toBe('dark')
    expect(readStoredTheme(storage('light'))).toBe('light')
    expect(readStoredTheme(storage('system'))).toBe('system')
  })

  it('falls back to following the OS when nothing is stored', () => {
    expect(readStoredTheme(storage(null))).toBe('system')
  })

  // A stale/corrupt value used to be cast straight to Theme and then applied as
  // a class name, which silently produced neither light nor dark.
  it('falls back to system for an unrecognized stored value', () => {
    expect(readStoredTheme(storage('midnight'))).toBe('system')
  })

  it('falls back to system when localStorage access throws', () => {
    expect(
      readStoredTheme({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('passes explicit choices through untouched', () => {
    expect(resolveTheme('dark')).toBe('dark')
    expect(resolveTheme('light')).toBe('light')
  })

  it('resolves "system" against the OS preference', () => {
    // jsdom reports no match for prefers-color-scheme: dark.
    expect(resolveTheme('system')).toBe('light')
  })
})
