/**
 * User-facing switches that change what the collection path is allowed to do.
 * Kept in `chrome.storage.local` (not module constants) so the content script,
 * the options page and the background worker all read the same live value.
 */

/**
 * Whether the adapters' `selfFetch` capability may run — the one part of this
 * extension that issues requests of its own instead of only observing what the
 * page already fetched (Instagram's private list API with the page's session,
 * GitHub's public REST API). It exists because DOM scrolling alone was measured
 * to miss real followers, which produces wrong "doesn't follow back" results.
 *
 * Default ON, because turning it off measurably degrades scan completeness on
 * Instagram — but it is a switch, not a hardcoded behavior, so a user who wants
 * strictly passive collection (nothing beyond the requests their own scrolling
 * triggers) can have it. With it off, every platform falls back to the DOM /
 * passive-observation path.
 */
export const SELF_FETCH_KEY = 'followlensSelfFetchEnabled'

/**
 * Prefix of the per-platform "don't retry self-fetch until" timestamps the
 * content script writes after a platform rejects a pass (see
 * `startSelfFetchCooldown`). Lives here rather than in the content script so
 * "delete everything" in Settings can find and clear them: a cooldown is
 * transient scan state keyed by account, not a user setting, and leaving it
 * behind meant a wipe was silently followed by hours of degraded (DOM-only)
 * collection with nothing in the UI explaining why — the same bug already
 * fixed for `expectedCounts`.
 */
export const SELF_FETCH_COOLDOWN_KEY_PREFIX = 'followlensSelfFetchCooldownUntil:'

/** Every self-fetch cooldown key currently in storage — the set a data wipe has to clear. */
export async function listSelfFetchCooldownKeys(
  storage: Pick<typeof chrome.storage.local, 'get'> = chrome.storage.local,
): Promise<string[]> {
  try {
    const all = await storage.get(null)
    return Object.keys(all ?? {}).filter((key) => key.startsWith(SELF_FETCH_COOLDOWN_KEY_PREFIX))
  } catch {
    return []
  }
}

export async function isSelfFetchAllowed(
  storage: Pick<typeof chrome.storage.local, 'get'> = chrome.storage.local,
): Promise<boolean> {
  try {
    const stored = await storage.get(SELF_FETCH_KEY)
    // Absent means "never chosen" → the default, not "off".
    return stored?.[SELF_FETCH_KEY] !== false
  } catch {
    // Storage unavailable: fall back to the documented default rather than
    // silently changing collection behavior.
    return true
  }
}
