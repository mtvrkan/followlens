// Runs in the page's MAIN world on every platform that opts into request
// interception (Instagram). Never initiates requests itself — it only observes responses to
// fetch calls the page (and the user's own scrolling) already makes. This
// keeps behavior indistinguishable from a real user, which matters for not
// tripping each platform's automation detection.

import { adaptersById, matchJsonRequest } from '../platforms/registry'
import type { FriendshipDirection, PlatformAdapter, PlatformId, SocialUser } from '../platforms/types'
import { isStartSelfFetchMessage, isStopSelfFetchMessage } from '../shared/messages'
import { debugLog, initDebugLoggingFromDom } from '../shared/debug'

// No chrome.storage in the MAIN world — the flag arrives as an attribute the
// content script mirrors onto <html> (see shared/debug.ts).
initDebugLoggingFromDom()

function emit(
  platform: PlatformId,
  direction: FriendshipDirection,
  accountId: string,
  users: SocialUser[],
  hasMore: boolean | null,
  /** The platform's own exact total for this direction when the response carries one (see `PlatformAdapter.parseTotal`). */
  total: number | null = null,
) {
  // A hasMore signal (even "false", with zero new users on the final page)
  // is still worth sending — it's what lets the content script know for
  // certain the platform itself says the list is done, instead of guessing
  // from a profile header stat.
  if (users.length === 0 && hasMore == null && total == null) return
  window.postMessage(
    { source: 'followlens', type: 'FRIENDSHIP_PAGE', platform, direction, accountId, users, hasMore, total },
    window.location.origin,
  )
}

const originalFetch = window.fetch

window.fetch = async function patchedFetch(...args: Parameters<typeof fetch>) {
  // Resolved BEFORE the request is awaited, so the direction stamped on this
  // response is the one that was open when the page asked for it — not
  // whichever list happens to be open by the time the bytes come back.
  //
  // This used to run after `await originalFetch(...)`, which is where TikTok's
  // followers and following lists got mixed into each other: its generic
  // /api/user/list/ endpoint names no direction in the URL, so the adapter
  // resolves it from which list is currently open. Switching lists while
  // follower pages were still in flight then stamped those late-landing
  // follower responses as "following" — a whole list's worth of people
  // written into the wrong bucket. The XHR path below already resolved this
  // at send() for exactly this reason; fetch now matches it.
  //
  // No change for adapters whose matchRequest is a pure function of the URL
  // (Instagram): same URL in, same result out, whenever it is called.
  let matched: ReturnType<typeof matchJsonRequest> = null
  let requestUrl = ''
  try {
    const input = args[0]
    requestUrl = typeof input === 'string' ? input : (input as Request).url
    matched = matchJsonRequest(requestUrl, window.location.hostname)
    if (matched) {
      debugLog('dispatching matched request', { adapter: matched.adapter.id, direction: matched.direction, accountId: matched.accountId, url: requestUrl })
    }
  } catch {
    // Never let interception errors affect the page's own request.
  }

  const response = await originalFetch.apply(this, args)

  try {
    if (matched) {
      const { adapter, accountId, direction } = matched
      response
        .clone()
        .json()
        .then((json) => {
          const users = adapter.parseUsers?.(json) ?? []
          const hasMore = adapter.parseHasMore?.(json) ?? null
          debugLog('matched request', { adapter: adapter.id, direction, accountId, users: users.length, hasMore, url: requestUrl })
          emit(adapter.id, direction, accountId, users, hasMore, adapter.parseTotal?.(json) ?? null)
        })
        .catch(() => {
          // Response shape changed or wasn't JSON — silently ignore rather
          // than risk breaking the page's real fetch flow.
        })
    } else if (/\/graphql\/.*\/(Followers|Following)/i.test(requestUrl)) {
      // Looks like the right endpoint but didn't match — most likely the
      // account id couldn't be extracted from `variables`, which silently
      // drops the whole response. Surfacing it here (rather than staying
      // silent) is what makes a "switches to following but collects
      // nothing" report diagnosable from the console.
      debugLog('Follow-like request did not match, dropped', requestUrl)
    }
  } catch {
    // Never let interception errors affect the page itself.
  }

  return response
}

// Instagram's `/api/v1/...` endpoints (the ones friendship lists use) are
// largely legacy "private API" routes inherited from the mobile app, and
// Instagram's web bundle still issues a lot of them via XMLHttpRequest
// rather than fetch — without this, those requests are invisible to us.
const xhrRequestUrls = new WeakMap<XMLHttpRequest, string>()
const originalXhrOpen = XMLHttpRequest.prototype.open
const originalXhrSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
  xhrRequestUrls.set(this, typeof url === 'string' ? url : url.toString())
  // `open` has multiple overloads upstream; forwarding the raw args avoids re-declaring them all.
  return (originalXhrOpen as (...openArgs: unknown[]) => void).call(this, method, url, ...rest)
}

XMLHttpRequest.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
  const url = xhrRequestUrls.get(this)
  const matched = url ? matchJsonRequest(url, window.location.hostname) : null

  if (matched) {
    const { adapter, accountId, direction } = matched
    this.addEventListener('load', () => {
      try {
        const json = this.responseType === '' || this.responseType === 'text' ? JSON.parse(this.responseText) : this.response
        emit(adapter.id, direction, accountId, adapter.parseUsers?.(json) ?? [], adapter.parseHasMore?.(json) ?? null, adapter.parseTotal?.(json) ?? null)
      } catch {
        // Response wasn't JSON or the shape changed — ignore.
      }
    })
  }

  return (originalXhrSend as (...sendArgs: unknown[]) => void).apply(this, args)
}

// --- Self-fetch: actively paginates a platform's private list API instead
// of relying on DOM scroll or waiting for the page to fetch on its own —
// see PlatformAdapter.selfFetch's doc comment (platforms/types.ts) for why
// this is a deliberate, opt-in exception to the "only observe" principle
// this file otherwise follows. Only runs for adapters that expose
// `selfFetch` (Instagram). This context is the only place these requests
// can be issued as genuinely first-party: same origin, page's own session
// cookies, no extra permissions needed. Uses `originalFetch` (not the
// patched `window.fetch` above) so these requests aren't also re-parsed by
// the fetch-interception path and double-emitted.
let selfFetchAborted = false

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay(min: number, max: number): Promise<void> {
  return sleep(min + Math.random() * (max - min))
}

// A 429 is transient by nature — worth waiting out rather than treating like
// any other failure (which would abandon self-fetch for the whole scan and
// fall back to the slower DOM path). Honors the platform's own Retry-After
// when it sends one; otherwise backs off a bit further on each successive
// retry. Any other non-2xx (401/403/5xx) is not retried here — those aren't
// "wait and it'll work", so they fall straight through to the caller's
// existing fallback-to-DOM handling.
const SELF_FETCH_RATE_LIMIT_RETRIES = 3
const SELF_FETCH_RATE_LIMIT_DEFAULT_BACKOFF_MS = 3000

// `referrer` lets a call mimic the actual page a real user would be on when
// the browser issues this request (e.g. the followers/following list page
// itself, not wherever the tab happens to be sitting) — some of Instagram's
// legacy private-API endpoints have been seen validating this in addition to
// the CSRF header.
async function selfFetchResponse(
  url: string,
  headers: Record<string, string>,
  referrer?: string,
  credentials: RequestCredentials = 'include',
  retriesLeft = SELF_FETCH_RATE_LIMIT_RETRIES,
): Promise<Response> {
  const response = await originalFetch(url, { credentials, headers, ...(referrer ? { referrer } : {}) })
  if (response.status === 429 && retriesLeft > 0) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After'))
    const backoffMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : SELF_FETCH_RATE_LIMIT_DEFAULT_BACKOFF_MS * (SELF_FETCH_RATE_LIMIT_RETRIES - retriesLeft + 1)
    debugLog('self-fetch: rate-limited (429), backing off', { backoffMs, retriesLeft })
    await sleep(backoffMs)
    if (selfFetchAborted) throw new Error('self-fetch aborted during rate-limit backoff')
    return selfFetchResponse(url, headers, referrer, credentials, retriesLeft - 1)
  }
  if (!response.ok) throw new Error(`self-fetch request failed: ${response.status}`)
  return response
}

async function selfFetchJson(
  url: string,
  headers: Record<string, string>,
  referrer?: string,
  credentials?: RequestCredentials,
): Promise<unknown> {
  const response = await selfFetchResponse(url, headers, referrer, credentials)
  // A 2xx status doesn't guarantee a JSON body — Instagram has been seen
  // silently serving the plain HTML app shell instead of the expected
  // response (no distinct error status at all) when a request is missing
  // something it expects. Checking content-type up front turns that into a
  // clear, specific error instead of a bare "Unexpected token '<'"
  // JSON.parse SyntaxError further down.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error(`self-fetch response was not JSON (content-type: ${contentType || 'unknown'}) — likely rejected despite a 2xx status`)
  }
  return response.json()
}

function postSelfFetchMessage(message: Record<string, unknown>): void {
  window.postMessage({ source: 'followlens', ...message }, window.location.origin)
}

// Walks the list from the start (cursor=null) to wherever the API's own
// has_more says it ends, adding every distinct username turned up into
// `seen` — a set SHARED ACROSS RETRY ATTEMPTS (see the wrapper below), not
// reset per walk. Confirmed live: two separate full walks of the same
// account's followers each independently landed on has_more:false at ~124
// distinct users, but were two DIFFERENT ~124-subsets of the real 139 —
// their union was 138. Instagram's pagination is evidently not fully
// deterministic across separate top-level walks (same underlying issue as
// the old DOM-scroll approach, just far less severe). Comparing each
// attempt's own local count against the previous attempt's own local count
// would have missed that real progress — 124 vs 124 looks like a tie even
// though the union grew by 14 — so progress has to be measured against the
// running union instead.
// Backstop only, not expected to ever bind in practice (500 pages at
// pageSize=100 is 50,000 users) — guards against a genuinely stuck loop
// (e.g. a future response-shape change parseNextCursor mis-reads) hammering
// the API indefinitely instead of just failing loudly once and falling back.
const SELF_FETCH_MAX_PAGES_PER_WALK = 500

async function collectSelfFetchDirection(
  adapter: PlatformAdapter,
  selfFetch: NonNullable<PlatformAdapter['selfFetch']>,
  headers: Record<string, string>,
  platform: PlatformId,
  accountId: string,
  pk: string,
  direction: FriendshipDirection,
  seen: Set<string>,
  // null when the profile lookup didn't carry this direction's count — the
  // walk then has nothing to stop early against and always runs to has_more.
  expected: number | null,
): Promise<void> {
  let cursor: string | null = null
  let hasMore = true
  let pages = 0
  const referrer = selfFetch.buildReferrer?.(accountId, direction)
  while (hasMore && !selfFetchAborted && pages < SELF_FETCH_MAX_PAGES_PER_WALK) {
    pages += 1
    const json = await selfFetchJson(selfFetch.buildListUrl(pk, direction, cursor), headers, referrer, selfFetch.credentials)
    const users = adapter.parseUsers?.(json) ?? []
    const apiHasMore = adapter.parseHasMore?.(json) ?? null
    users.forEach((u) => seen.add(u.username.toLowerCase()))
    debugLog('self-fetch page', { platform, direction, accountId, users: users.length, apiHasMore, cursor, unionSoFar: seen.size })
    emit(platform, direction, accountId, users, apiHasMore)
    // The target's already been reached — every remaining page would just be
    // more requests for accounts already counted. Without this, a walk kept
    // paginating all the way to Instagram's own has_more:false even once the
    // profile's stated total was long since satisfied, which both wasted
    // requests (the opposite of staying inconspicuous) and looked "stuck" to
    // the user, since the buffer count it reports mid-walk had already
    // caught up while this loop itself had many pages left to go.
    if (expected != null && seen.size >= expected) {
      debugLog('self-fetch: reached the profile\'s stated total mid-walk, stopping early', { direction, collected: seen.size, expected, pages })
      return
    }
    const nextCursor = selfFetch.parseNextCursor(json, cursor)
    // A cursor that comes back identical to the one just requested means
    // pagination isn't actually advancing — continuing would hammer the same
    // URL forever rather than genuinely walking the list.
    if (nextCursor && nextCursor === cursor) {
      debugLog('self-fetch: next cursor repeated the current one, stopping this walk to avoid a stuck loop', { direction, cursor })
      break
    }
    cursor = nextCursor
    hasMore = !!cursor && apiHasMore !== false
    if (hasMore) await randomDelay(selfFetch.minDelayMs, selfFetch.maxDelayMs)
  }
  if (pages >= SELF_FETCH_MAX_PAGES_PER_WALK) {
    debugLog('self-fetch: hit the per-walk page cap, stopping this walk', { direction, pages })
  }
}

// Instagram's own has_more:false doesn't always mean the profile's stated
// total was actually reached (see the comment above) — a bare single walk
// can land short. Re-walking, tracking the union, recovers most of the gap;
// live testing shows it converging fast (2-3 walks) whenever the remainder is
// genuinely reachable. Not capped low anymore — a small fixed cap (this used
// to be 2, briefly 5 before that) meant a scan could give up short of the
// real total purely because the budget ran out, not because there was
// nothing left to find, which is exactly what produces a wrong "doesn't
// follow back" result downstream. The actual stopping condition is still
// "did the last walk add anything to the union" just below: once that's
// false, the remainder is most likely the real reachable ceiling (some
// accounts counted in the profile's header stat are provably not enumerable
// via this endpoint — restricted/deactivated ones, as far as could be
// confirmed) and keeping the request budget bounded matters more than
// hammering a wall no amount of retrying gets through. This cap is a
// backstop against that check somehow never tripping, not the intended stop.
const SELF_FETCH_MAX_ATTEMPTS = 20

// A full-walk retry is a far more repetitive-looking request pattern than the
// per-page pauses inside one walk — a real person doesn't immediately
// re-scroll a list they just finished. So each retry waits longer than the
// last on top of the normal per-page pacing, on the same "wide, irregular
// beats a fixed cadence" logic as SELF_FETCH_MIN/MAX_DELAY_MS.
const SELF_FETCH_RETRY_BASE_DELAY_MS = 4000
const SELF_FETCH_RETRY_MAX_DELAY_MS = 25000

function retryWalkDelayMs(attempt: number): number {
  const scaled = Math.min(SELF_FETCH_RETRY_BASE_DELAY_MS * 2 ** attempt, SELF_FETCH_RETRY_MAX_DELAY_MS)
  return scaled + Math.random() * scaled * 0.5
}

async function collectSelfFetchDirectionWithRetries(
  adapter: PlatformAdapter,
  selfFetch: NonNullable<PlatformAdapter['selfFetch']>,
  headers: Record<string, string>,
  platform: PlatformId,
  accountId: string,
  pk: string,
  direction: FriendshipDirection,
  // null when the profile lookup didn't carry this direction's count (rare
  // edge case) — a single walk still runs, trusting has_more alone, just
  // with nothing to retry against since there's no target to compare to.
  expected: number | null,
): Promise<void> {
  const seen = new Set<string>()
  let previousCount = 0
  for (let attempt = 0; attempt < SELF_FETCH_MAX_ATTEMPTS && !selfFetchAborted; attempt++) {
    await collectSelfFetchDirection(adapter, selfFetch, headers, platform, accountId, pk, direction, seen, expected)
    const collected = seen.size
    if (expected == null || collected >= expected) return
    if (collected <= previousCount) {
      debugLog('self-fetch: retry made no further progress, stopping', { direction, collected, expected, attempt })
      return
    }
    previousCount = collected
    if (attempt < SELF_FETCH_MAX_ATTEMPTS - 1) {
      const delayMs = retryWalkDelayMs(attempt)
      debugLog('self-fetch: below the profile\'s stated total, retrying', { direction, collected, expected, attempt, delayMs: Math.round(delayMs) })
      await sleep(delayMs)
      if (selfFetchAborted) return
    }
  }
  if (!selfFetchAborted) {
    debugLog('self-fetch: hit the retry-walk cap, stopping', { direction, collected: seen.size, expected })
  }
}

// Above this, a full self-fetch pass would need too many paginated requests
// (at pageSize=12) to stay inside a safe request budget for one session.
const SELF_FETCH_MAX_ENUMERABLE = 2000

async function runSelfFetch(platform: PlatformId, username: string): Promise<void> {
  const adapter = adaptersById[platform]
  const selfFetch = adapter?.selfFetch
  if (!selfFetch) {
    postSelfFetchMessage({ type: 'SELF_FETCH_FAILED', platform })
    return
  }

  selfFetchAborted = false
  const headers = selfFetch.requestHeaders()
  // Diagnostic only, never the token itself — if a run still fails as "not
  // JSON despite 2xx" with this showing `present`, the CSRF header wasn't
  // the (whole) problem and something else about the request is being
  // rejected.
  debugLog('self-fetch: starting', { platform, username, csrfToken: headers['X-CSRFToken'] ? 'present' : 'MISSING' })

  let profile: ReturnType<typeof selfFetch.parseProfile> = null
  try {
    const profileResponse = await selfFetchResponse(selfFetch.buildProfileUrl(username), headers, undefined, selfFetch.credentials)
    // Instagram's own web client echoes this back as X-IG-WWW-Claim on every
    // subsequent private-API call in the session — a documented anti-abuse
    // mechanism (the server issues a "claim" on one response, the client is
    // expected to present it on the next request). Not doing this at all
    // was a plausible reason the list endpoint kept rejecting us with a
    // silent HTML fallback even once the CSRF/search_surface pieces were
    // both correct.
    const claim = profileResponse.headers.get('x-ig-set-www-claim')
    if (claim) {
      headers['X-IG-WWW-Claim'] = claim
      // Presence only, never the value — same rule the CSRF line above follows.
      // Debug logging exists to be turned on and pasted into a bug report, and
      // this claim is a live session-bound credential: printing it would put it
      // in whatever the user copies out of the console.
      debugLog('self-fetch: got a www-claim token, will echo it on list requests')
    }
    profile = selfFetch.parseProfile(await profileResponse.json())
  } catch (e) {
    debugLog('self-fetch: profile lookup failed', e)
  }
  if (!profile || selfFetchAborted) {
    postSelfFetchMessage({ type: 'SELF_FETCH_FAILED', platform })
    return
  }

  // A large account would need hundreds of paginated requests at the small,
  // organic-shaped page size above — exactly the volume most likely to read
  // as scraping rather than a person scrolling. Not worth the risk: hand
  // accounts this size straight to the DOM path instead of even trying.
  if ((profile.followers ?? 0) > SELF_FETCH_MAX_ENUMERABLE || (profile.following ?? 0) > SELF_FETCH_MAX_ENUMERABLE) {
    debugLog('self-fetch: account too large for a safe self-fetch pass, falling back to the DOM flow', {
      followers: profile.followers,
      following: profile.following,
      ceiling: SELF_FETCH_MAX_ENUMERABLE,
    })
    postSelfFetchMessage({ type: 'SELF_FETCH_FAILED', platform })
    return
  }

  postSelfFetchMessage({ type: 'SELF_FETCH_COUNTS', platform, followers: profile.followers, following: profile.following })

  try {
    await collectSelfFetchDirectionWithRetries(adapter, selfFetch, headers, platform, username, profile.pk, 'followers', profile.followers)
    if (selfFetchAborted) return
    await collectSelfFetchDirectionWithRetries(adapter, selfFetch, headers, platform, username, profile.pk, 'following', profile.following)
  } catch (e) {
    debugLog('self-fetch: list pagination failed', e)
    if (!selfFetchAborted) postSelfFetchMessage({ type: 'SELF_FETCH_FAILED', platform })
    return
  }

  if (!selfFetchAborted) postSelfFetchMessage({ type: 'SELF_FETCH_DONE', platform })
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return
  if (isStartSelfFetchMessage(event.data)) {
    void runSelfFetch(event.data.platform, event.data.username)
  } else if (isStopSelfFetchMessage(event.data)) {
    selfFetchAborted = true
  }
})
