import { vi } from 'vitest'

type Listener = (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean | void

/**
 * Minimal chrome.storage/runtime/action stand-in for testing the background
 * service worker outside a real browser. get/set resolve after a tick, the
 * same way real chrome.storage IPC does — this is what makes the race
 * condition between concurrent onMessage handlers reproducible in a test.
 */
export function createChromeMock() {
  const sessionStore: Record<string, unknown> = {}
  const localStore: Record<string, unknown> = {}
  const listeners: Listener[] = []

  function delay<T>(value: T): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(value), 5))
  }

  function makeArea(store: Record<string, unknown>) {
    return {
      get: (keys: string | string[]) => {
        const keyList = Array.isArray(keys) ? keys : [keys]
        const result: Record<string, unknown> = {}
        for (const key of keyList) {
          if (key in store) result[key] = store[key]
        }
        return delay(result)
      },
      set: (values: Record<string, unknown>) => {
        Object.assign(store, values)
        return delay(undefined)
      },
      remove: (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]
        return delay(undefined)
      },
    }
  }

  const chrome = {
    storage: {
      session: makeArea(sessionStore),
      local: makeArea(localStore),
    },
    runtime: {
      onMessage: {
        addListener: (fn: Listener) => listeners.push(fn),
      },
      onInstalled: {
        addListener: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
      },
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
    tabs: {
      create: vi.fn(() => Promise.resolve()),
    },
    action: {
      setBadgeText: vi.fn(() => Promise.resolve()),
      setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
    },
  }

  return { chrome, listeners, sessionStore, localStore }
}

/** Invokes a captured onMessage listener and waits for its sendResponse call. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests assert on loosely-shaped responses
export function dispatch(listener: Listener, message: unknown): Promise<any> {
  return new Promise((resolve) => {
    listener(message, {}, resolve)
  })
}

export function deleteFollowLensDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('followlens')
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
