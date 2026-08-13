import type { PlatformAdapter, PlatformId } from './types'
import { instagramAdapter } from './instagram'
import { githubAdapter } from './github'

// Every supported platform. TikTok and X were both removed: X padded short
// lists with algorithmic "who to follow" suggestions that no reliable signal
// separated from real rows, and TikTok's only usable collection path was
// intercepting responses from an API whose requests it signs with an
// obfuscated, frequently-rotated scheme — neither could be made to produce
// trustworthy follower data, and wrong data here is worse than none.
const ALL_ADAPTERS: PlatformAdapter[] = [instagramAdapter, githubAdapter]

export const adapters: PlatformAdapter[] = ALL_ADAPTERS

/**
 * Adapters offered for starting a new scan (platform pickers, manifest
 * permissions). Identical to `adapters` now that nothing is registered-but-
 * disabled; kept as its own export because the two mean different things —
 * this one answers "what can be scanned", `adapters` answers "what can be
 * rendered", and a platform retired in the future would again differ.
 */
export const enabledAdapters: PlatformAdapter[] = ALL_ADAPTERS

export const adaptersById: Record<PlatformId, PlatformAdapter> = Object.fromEntries(
  adapters.map((adapter) => [adapter.id, adapter]),
) as Record<PlatformId, PlatformAdapter>

/**
 * Scoped to the page's own hostname rather than checked against every
 * adapter — the same injected script runs on every platform that opts into
 * network interception, so without this a request on one platform's page
 * that happens to match another platform's URL pattern would get attributed
 * to the wrong platform. Gated on `matchRequest` being defined, not on
 * `mode` — a dom-mode adapter (Instagram) can still opt into this as a
 * supplementary, more reliable data source alongside its own DOM scrape.
 */
export function matchJsonRequest(
  url: string,
  hostname: string,
): { adapter: PlatformAdapter; accountId: string; direction: 'followers' | 'following' } | null {
  const adapter = getAdapterForHost(hostname)
  if (!adapter || !adapter.matchRequest) return null
  const match = adapter.matchRequest(url)
  return match ? { adapter, ...match } : null
}

function hostnameMatches(hostname: string, registered: string): boolean {
  return hostname === registered || hostname.endsWith(`.${registered}`)
}

export function getDomAdapterForHost(hostname: string): PlatformAdapter | null {
  const adapter = getAdapterForHost(hostname)
  return adapter?.mode === 'dom' ? adapter : null
}

/** Finds whichever adapter owns a hostname, regardless of collection mode — used to detect which platform the user's active tab belongs to. */
export function getAdapterForHost(hostname: string): PlatformAdapter | null {
  return adapters.find((a) => a.hostnames.some((h) => hostnameMatches(hostname, h))) ?? null
}

/** Builds manifest match patterns (e.g. 'https://github.com/*') for enabled adapters of a given mode — a disabled platform gets no host permission. */
export function manifestMatchPatternsForMode(mode: 'json' | 'dom'): string[] {
  return enabledAdapters
    .filter((adapter) => adapter.mode === mode)
    .flatMap((adapter) => adapter.hostnames.flatMap((host) => [`https://${host}/*`, `https://www.${host}/*`]))
}

/**
 * Hosts for the injected (MAIN-world) script, which does two jobs — passive
 * network interception (`matchRequest`) and active list pagination
 * (`selfFetch`) — so an adapter needing either one must be registered here.
 * Distinct from manifestMatchPatternsForMode('json') on both counts: a dom-mode
 * adapter can want interception as a supplementary data source (Instagram) or
 * want self-fetch with no interception at all (GitHub, whose page makes no JSON
 * request to observe but whose public REST API self-fetch still has to run in
 * the page's MAIN world). Filtering on `matchRequest` alone left GitHub without
 * the script that answers START_SELF_FETCH, so every GitHub scan posted that
 * message into the void and only started collecting after the content script's
 * 5-second watchdog gave up — with the adapter's whole self-fetch path
 * unreachable dead code.
 */
export function manifestMatchPatternsForInjectedScript(): string[] {
  return enabledAdapters
    .filter((adapter) => !!adapter.matchRequest || !!adapter.selfFetch)
    .flatMap((adapter) => adapter.hostnames.flatMap((host) => [`https://${host}/*`, `https://www.${host}/*`]))
}

/** Builds manifest match patterns across every adapter, regardless of mode. */
export function manifestMatchPatterns(): string[] {
  return [...manifestMatchPatternsForMode('json'), ...manifestMatchPatternsForMode('dom')]
}
