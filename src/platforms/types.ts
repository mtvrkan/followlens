export type PlatformId = 'instagram' | 'github'
export type FriendshipDirection = 'followers' | 'following'

export interface SocialUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string
  isVerified: boolean
  isPrivate: boolean
}

export interface RequestMatch {
  accountId: string
  direction: FriendshipDirection
}

export interface DomListPage {
  accountId: string
  accountUsername: string
  direction: FriendshipDirection
}

/**
 * What `PlatformAdapter.selfFetch.parseProfile` reads off a profile lookup
 * response. Only `pk` is required to proceed — a profile response missing
 * one of the counts (seen on some restricted/edge-case profiles) still lets
 * self-fetch paginate that direction, just without a target to retry
 * against, so it falls back to trusting the API's own has_more alone.
 */
export interface SelfFetchProfile {
  /** The platform's internal numeric account id ("pk") — required by the list endpoint. */
  pk: string
  followers: number | null
  following: number | null
}

/**
 * Opt-in capability for platforms where directly paginating a list API
 * (rather than scrolling the rendered DOM) is reliable enough to be worth the
 * trade-off of actively issuing requests instead of only observing ones the
 * page already made. Fits both an official public API (GitHub — no session,
 * no detection risk, delays are just request-volume etiquette) and a private
 * one (Instagram — same-origin session cookies, delays matter for not
 * reading as scripted traffic). Pure URL-building/parsing only — the actual
 * fetch()ing happens in the MAIN-world injected script, the only context
 * that can issue same-origin requests as first-party where that matters.
 * `parseUsers`/`parseHasMore` on the adapter itself are reused to parse each
 * list page's response.
 */
export interface SelfFetchCapability {
  buildProfileUrl: (username: string) => string
  parseProfile: (json: unknown) => SelfFetchProfile | null
  buildListUrl: (pk: string, direction: FriendshipDirection, cursor: string | null) => string
  /**
   * `currentCursor` is whatever `buildListUrl` was just called with — needed
   * by adapters (GitHub) whose response body carries no cursor/pagination
   * info of its own, so the next page can only be derived from what was just
   * requested (e.g. incrementing a page number). Instagram's next cursor
   * comes straight out of the JSON and ignores this second argument.
   */
  parseNextCursor: (json: unknown, currentCursor?: string | null) => string | null
  /**
   * Headers to send on both the profile lookup and every list request. Keep
   * these inside the CORS-safelisted set (`Accept` and friends) for any
   * cross-origin API: a non-safelisted header forces a preflight the API may
   * not answer, which fails the whole request rather than merely dropping the
   * header. Same-origin capabilities (Instagram) have no such constraint.
   */
  requestHeaders: () => Record<string, string>
  /**
   * How the fetch carries cookies. `include` for a same-origin private API
   * that authenticates via the page's own session (Instagram). `omit` for a
   * public cross-origin API: those answer with `Access-Control-Allow-Origin: *`,
   * which the browser refuses to pair with credentialed requests — so sending
   * cookies there fails CORS instead of just being ignored. Defaults to
   * `include`.
   */
  credentials?: RequestCredentials
  /** How many rows to request per page. */
  pageSize: number
  /** Random delay range (ms) between consecutive requests. */
  minDelayMs: number
  maxDelayMs: number
  /** Referrer header override for list requests — omit for adapters (GitHub) whose API neither needs nor expects one. */
  buildReferrer?: (accountId: string, direction: FriendshipDirection) => string
}

/**
 * A platform contributes one of two collection modes, never both:
 * - "json": page already calls its own API as the user scrolls; we only
 *   read the response (injected-script.ts, MAIN world).
 * - "dom": platform renders the list server-side with no JSON endpoint to
 *   intercept, so we read the rendered rows instead (content-script.ts).
 * Both modes are passive — neither issues a request the user didn't already
 * trigger — EXCEPT for the optional `selfFetch` capability below, which is a
 * deliberate, opt-in exception to that rule for platforms where the DOM/
 * passive-network approach has proven unreliable (see instagram.ts).
 */
export interface PlatformAdapter {
  id: PlatformId
  label: string
  mode: 'json' | 'dom'
  /** Bare hostnames this adapter is responsible for, e.g. ['instagram.com']. */
  hostnames: string[]
  matchRequest?: (url: string) => RequestMatch | null
  parseUsers?: (json: unknown) => SocialUser[]
  /**
   * Whether the platform's own paginated response says there's more to
   * fetch for this request, when that's exposed (Instagram's friendship API
   * has `has_more`). Authoritative where available — more trustworthy than
   * comparing a collected count against a profile header stat, which can be
   * stale or count accounts that aren't actually enumerable. Returns null
   * when the response doesn't carry this signal.
   */
  parseHasMore?: (json: unknown) => boolean | null
  /**
   * The account's own exact total for the direction this response belongs to,
   * when the response body states it (TikTok's follower-list responses carry
   * `total`). Strictly better than `expectedCount`'s scrape of the profile
   * header, which every platform abbreviates once the number gets large —
   * TikTok renders "1.2M", which `parseStatCount` correctly refuses to guess
   * at, leaving the scan with no target at all on any sizeable account.
   * Returns null when the response says nothing about a total.
   */
  parseTotal?: (json: unknown) => number | null
  detectListPage?: (location: Location) => DomListPage | null
  /** `page` is the same result detectListPage just returned, so an adapter that needs its own accountId (e.g. to exclude it as a false-positive row) doesn't have to re-derive it. */
  parseDom?: (root: ParentNode, page: DomListPage) => SocialUser[]
  /**
   * How a dom-mode adapter loads more rows once the first batch is visible:
   * 'paginated' follows rel="next" links (GitHub), 'infinite' scrolls the
   * list's own container (Instagram). Irrelevant for json-mode adapters.
   */
  scrollBehavior?: 'infinite' | 'paginated'
  /**
   * Opens the given list so auto-collection can proceed without the user
   * manually clicking into the followers/following dialog themselves. May
   * navigate (a full page load), so the caller cannot assume synchronous
   * completion — the content script re-derives its position from
   * detectListPage()/sessionStorage after the fact. Returns false if there's
   * nothing to open from (e.g. the current page isn't a profile or list).
   */
  openList?: (direction: FriendshipDirection) => boolean
  /**
   * The account username read straight from the current URL (profile page or
   * an already-open list), when the platform's URL scheme makes that
   * possible. Cheaper and more available than a DOM lookup (e.g. a
   * `link[rel="canonical"]` tag) — kickCollection() tries this first so a
   * self-fetch pass can start immediately instead of falling back to the
   * slower DOM click flow just because the page hasn't fully rendered yet.
   */
  usernameFromUrl?: () => string | null
  /**
   * The platform's own stated total for `direction` (e.g. the "131 takipçi"
   * profile stat), when it can be read as an exact number. Lets the scroll
   * loop stop once it's collected that many instead of relying only on
   * "did the scrollable area stop growing" — which a suggested-accounts
   * strip Instagram appends after the real list ends can spoof, since it
   * keeps the container growing past the point the real list was exhausted.
   * Returns null when there's no such stat, or it's abbreviated/rounded
   * ("12,3 B") and so can't be trusted as exact.
   */
  expectedCount?: (direction: FriendshipDirection) => number | null
  /**
   * Closes whatever list dialog openList() opened. Called once the guided
   * followers→following sequence finishes, so the user isn't left staring
   * at an open modal after collection has already stopped itself.
   */
  closeList?: () => void
  /**
   * Abandons any re-click an adapter still has scheduled from `openList`.
   * Required of every adapter whose `openList` retries on a timer (Instagram —
   * some builds' React handlers ignore the first dispatched, non-trusted
   * click, so it fires again ~1.2s and ~2.6s later).
   *
   * Those timers know nothing about collection state, so pressing Stop in the
   * first couple of seconds of a scan still popped the followers dialog open
   * afterwards — the user stopped, and the page acted anyway. The content
   * script calls this the moment collection is switched off, the same way
   * GitHub's `goToNextPage` re-checks `collecting` inside its own delay before
   * navigating. Adapters that open a list by navigating outright (X) have
   * nothing pending and leave this undefined.
   */
  cancelPendingOpen?: () => void
  /**
   * One-time setup, run only inside the content script's actual page
   * context (never background/popup/dashboard, which also import this
   * adapter but have no DOM). For platforms where opening the list dialog
   * doesn't change the URL (Instagram), this is where an adapter can attach
   * its own listeners to figure out state detectListPage/parseDom alone
   * can't observe.
   */
  init?: () => void
  /** See `SelfFetchCapability`. Absent for every adapter except Instagram. */
  selfFetch?: SelfFetchCapability
}
