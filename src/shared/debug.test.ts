import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEBUG_DOM_ATTRIBUTE,
  DEBUG_LOGGING_KEY,
  debugLog,
  initDebugLoggingFromDom,
  initDebugLoggingFromStorage,
  setDebugLoggingResolver,
} from './debug'

function storageMock(initial: Record<string, unknown> = {}) {
  const listeners: ((changes: Record<string, { newValue?: unknown }>, areaName: string) => void)[] = []
  return {
    listeners,
    chrome: {
      storage: {
        local: { get: (key: string) => Promise.resolve({ [key]: initial[key] }) },
        onChanged: {
          addListener: (fn: (changes: Record<string, { newValue?: unknown }>, areaName: string) => void) => listeners.push(fn),
        },
      },
    },
  }
}

let logSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  document.documentElement.removeAttribute(DEBUG_DOM_ATTRIBUTE)
})

afterEach(() => {
  logSpy.mockRestore()
  vi.unstubAllGlobals()
  setDebugLoggingResolver(() => false)
  document.documentElement.removeAttribute(DEBUG_DOM_ATTRIBUTE)
})

describe('debugLog', () => {
  it('stays silent by default — an install that never opts in prints nothing', () => {
    debugLog('should not appear')

    expect(logSpy).not.toHaveBeenCalled()
  })

  it('prints with the FollowLens prefix once enabled', () => {
    setDebugLoggingResolver(() => true)

    debugLog('collected', { followers: 3 })

    expect(logSpy).toHaveBeenCalledWith('[FollowLens]', 'collected', { followers: 3 })
  })
})

describe('initDebugLoggingFromStorage', () => {
  it('enables logging when the stored flag is on, and mirrors it for the MAIN world', async () => {
    const { chrome } = storageMock({ [DEBUG_LOGGING_KEY]: true })
    vi.stubGlobal('chrome', chrome)

    initDebugLoggingFromStorage()
    await Promise.resolve()

    debugLog('visible')
    expect(logSpy).toHaveBeenCalled()
    expect(document.documentElement.hasAttribute(DEBUG_DOM_ATTRIBUTE)).toBe(true)
  })

  it('leaves logging off when nothing is stored', async () => {
    const { chrome } = storageMock()
    vi.stubGlobal('chrome', chrome)

    initDebugLoggingFromStorage()
    await Promise.resolve()

    debugLog('quiet')
    expect(logSpy).not.toHaveBeenCalled()
    expect(document.documentElement.hasAttribute(DEBUG_DOM_ATTRIBUTE)).toBe(false)
  })

  it('follows a later change to the setting without a reload', async () => {
    const { chrome, listeners } = storageMock({ [DEBUG_LOGGING_KEY]: false })
    vi.stubGlobal('chrome', chrome)
    initDebugLoggingFromStorage()
    await Promise.resolve()

    listeners.forEach((fn) => fn({ [DEBUG_LOGGING_KEY]: { newValue: true } }, 'local'))

    debugLog('now visible')
    expect(logSpy).toHaveBeenCalled()
    expect(document.documentElement.hasAttribute(DEBUG_DOM_ATTRIBUTE)).toBe(true)
  })

  it('stays quiet instead of throwing when the storage API is unavailable', () => {
    vi.stubGlobal('chrome', undefined)

    expect(() => initDebugLoggingFromStorage()).not.toThrow()
    debugLog('quiet')
    expect(logSpy).not.toHaveBeenCalled()
  })
})

describe('initDebugLoggingFromDom', () => {
  it('reads the flag the content script mirrored onto <html>', () => {
    initDebugLoggingFromDom()

    debugLog('before')
    expect(logSpy).not.toHaveBeenCalled()

    document.documentElement.setAttribute(DEBUG_DOM_ATTRIBUTE, '1')
    debugLog('after')
    expect(logSpy).toHaveBeenCalledTimes(1)
  })
})
