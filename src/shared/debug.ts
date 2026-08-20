/**
 * Diagnostic logging for the collection path (content script, MAIN-world
 * injected script, the adapters' DOM probing) — off unless the user turns it on
 * in Settings.
 *
 * These logs are genuinely valuable: every platform heuristic in `platforms/`
 * was derived from reading them against a live page, and they are the only way
 * to diagnose "the scan collected nothing" from a user's own browser. But they
 * used to be unconditional, which meant anyone who installed the extension got
 * a console full of `[FollowLens]` lines on every Instagram/GitHub page
 * they visited, whether or not a scan was even running. Genuine errors are NOT
 * routed through here — those keep logging unconditionally.
 *
 * Two init paths, because the two logging contexts can reach different APIs:
 *
 *  - `initDebugLoggingFromStorage()` — anywhere with the `chrome` API (content
 *    script, background, extension pages). Reads the flag, follows changes, and
 *    mirrors it onto <html> as an attribute.
 *  - `initDebugLoggingFromDom()` — the MAIN-world injected script, which has no
 *    `chrome.storage` at all. It reads that mirrored attribute instead, which is
 *    the one channel both worlds genuinely share.
 *
 * Both start quiet: a log line lost in the milliseconds before the flag resolves
 * matters far less than logging by default forever.
 */

export const DEBUG_LOGGING_KEY = 'followlensDebugLogging'
/** How the isolated world hands the flag to the MAIN world (see above). */
export const DEBUG_DOM_ATTRIBUTE = 'data-followlens-debug'

let isEnabled: () => boolean = () => false

export function debugLog(...args: unknown[]): void {
  if (isEnabled()) console.log('[FollowLens]', ...args)
}

/**
 * For call sites whose *arguments* are expensive to build — `outerHTML` on a
 * DOM node, a copy of a whole collected list. Those are evaluated before
 * `debugLog` is ever entered, so the check inside it saves only the
 * `console.log`, not the cost of preparing what to log. Two such sites sit on
 * genuinely hot paths (Instagram's header scan, which runs on every click and
 * every DOM report), where that preparation was happening on every call for
 * every user, with the flag off and nothing ever printed.
 */
export function isDebugLoggingEnabled(): boolean {
  return isEnabled()
}

/** Test seam and manual override — bypasses both init paths. */
export function setDebugLoggingResolver(resolver: () => boolean): void {
  isEnabled = resolver
}

function mirrorToDom(enabled: boolean): void {
  if (typeof document === 'undefined' || !document.documentElement) return
  if (enabled) document.documentElement.setAttribute(DEBUG_DOM_ATTRIBUTE, '1')
  else document.documentElement.removeAttribute(DEBUG_DOM_ATTRIBUTE)
}

export function initDebugLoggingFromStorage(): void {
  let enabled = false
  isEnabled = () => enabled

  const update = (next: boolean) => {
    enabled = next
    mirrorToDom(next)
  }

  try {
    // The .catch matters: this promise outlives the call, and a context torn
    // down before it settles (a tab closing mid-navigation, the service worker
    // suspending) would otherwise surface as an unhandled rejection — from the
    // logging switch, of all things. Failing to read the flag just means quiet.
    void chrome.storage.local
      .get(DEBUG_LOGGING_KEY)
      .then((stored) => update(stored?.[DEBUG_LOGGING_KEY] === true))
      .catch(() => update(false))
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[DEBUG_LOGGING_KEY]) update(changes[DEBUG_LOGGING_KEY].newValue === true)
    })
  } catch {
    // No storage access in this context — stay quiet rather than throwing into
    // whichever module imported this at load time.
    update(false)
  }
}

export function initDebugLoggingFromDom(): void {
  isEnabled = () => {
    try {
      return document.documentElement?.hasAttribute(DEBUG_DOM_ATTRIBUTE) === true
    } catch {
      return false
    }
  }
}
