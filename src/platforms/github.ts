import type { DomListPage, FriendshipDirection, PlatformAdapter, SelfFetchProfile, SocialUser } from './types'

// GitHub renders followers/following server-side — there's no JSON endpoint
// the *page itself* calls that we could passively intercept, so the DOM
// scrape below stays the fallback path. selfFetch (bottom of this file) adds
// a faster primary path on top of it: unlike Instagram's, this one calls
// GitHub's own official, public REST API — no session, no anti-bot concerns,
// just the documented 60-requests/hour unauthenticated rate limit.
const PROFILE_LINK_RE = /^\/([A-Za-z0-9-]+)\/?$/

// GitHub's own reserved top-level routes — real usernames can never be
// registered as one of these, so an avatar-adjacent link that happens to
// match one (site header/footer widgets, sponsor buttons) is a false
// positive, not a row. Mirrors instagram.ts's RESERVED_ROUTES; best-effort
// list, may need additions if GitHub adds new top-level routes.
const RESERVED_ROUTES = new Set([
  'settings', 'notifications', 'issues', 'pulls', 'marketplace', 'explore',
  'topics', 'collections', 'events', 'sponsors', 'about', 'pricing',
  'features', 'security', 'login', 'join', 'logout', 'dashboard', 'orgs',
  'new', 'search', 'trending', 'codespaces', 'copilot', 'customer-stories',
  'team', 'enterprise', 'site', 'contact', 'support', 'apps', 'account',
  'organizations',
])

// The username from wherever we currently are (a profile page, or an
// already-open followers/following tab — both keep the same /username
// pathname, the tab only changes the ?tab= query string). Shared by
// openList (DOM flow) and usernameFromUrl (lets self-fetch start immediately
// instead of waiting on a DOM lookup — see content-script.ts's
// guessAccountLabel).
function currentUsername(): string | null {
  const match = location.pathname.match(PROFILE_LINK_RE)
  const username = match?.[1]
  if (!username || RESERVED_ROUTES.has(username.toLowerCase())) return null
  return username
}

// --- Self-fetch: GitHub's official public REST API -------------------------
// https://docs.github.com/en/rest/users/followers — no auth, no cookies, no
// CSRF. per_page maxes out at 100 (vs Instagram's deliberately small 12 —
// there's no detection risk to hide from here, so no reason to take more
// requests than necessary against the hourly rate limit).
const GITHUB_SELF_FETCH_PAGE_SIZE = 100
// A short pause is basic request-volume etiquette, not anti-detection pacing
// (contrast Instagram's wide, human-shaped range) — this API is meant for
// exactly this kind of programmatic access.
const GITHUB_SELF_FETCH_MIN_DELAY_MS = 200
const GITHUB_SELF_FETCH_MAX_DELAY_MS = 500

interface GithubProfileResponse {
  login?: unknown
  followers?: unknown
  following?: unknown
}

function buildGithubProfileUrl(username: string): string {
  return `https://api.github.com/users/${encodeURIComponent(username)}`
}

function parseGithubProfile(json: unknown): SelfFetchProfile | null {
  if (!json || typeof json !== 'object') return null
  const data = json as GithubProfileResponse
  if (typeof data.login !== 'string' || !data.login) return null
  return {
    pk: data.login,
    followers: typeof data.followers === 'number' ? data.followers : null,
    following: typeof data.following === 'number' ? data.following : null,
  }
}

// `pk` here is GitHub's login (username) — the list endpoints key by
// username, not a separate numeric id, so the profile lookup's only real job
// is confirming the account exists and reading its stated follower/following
// counts.
function buildGithubListUrl(pk: string, direction: FriendshipDirection, cursor: string | null): string {
  const page = cursor ?? '1'
  return `https://api.github.com/users/${encodeURIComponent(pk)}/${direction}?per_page=${GITHUB_SELF_FETCH_PAGE_SIZE}&page=${page}`
}

// The response body is a bare array with no has_more/cursor field of its
// own — a page shorter than what was requested is the only signal available
// that the list is exhausted. (GitHub's Link response header carries a
// proper rel="next" URL, but parseHasMore/parseNextCursor only see the
// parsed JSON body, not response headers, so that signal isn't reachable
// here without a wider interface change than this is worth.)
function parseGithubHasMore(json: unknown): boolean | null {
  if (!Array.isArray(json)) return null
  return json.length === GITHUB_SELF_FETCH_PAGE_SIZE
}

// currentCursor is the page number just requested (see buildGithubListUrl) —
// needed here because, unlike Instagram's next_max_id, nothing in the
// response body itself says what page it was.
function parseGithubNextCursor(json: unknown, currentCursor?: string | null): string | null {
  if (!Array.isArray(json) || json.length < GITHUB_SELF_FETCH_PAGE_SIZE) return null
  return String(Number(currentCursor ?? '1') + 1)
}

interface GithubListUser {
  login?: unknown
  id?: unknown
  avatar_url?: unknown
}

// Follower/following list rows carry no display name (only login/id/avatar) —
// same degrade as the DOM scrape below, which reads the same thing off the
// rendered page. No verified/private concept exists for GitHub user accounts.
function parseGithubListUsers(json: unknown): SocialUser[] {
  if (!Array.isArray(json)) return []
  const users: SocialUser[] = []
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue
    const u = raw as GithubListUser
    if (typeof u.login !== 'string' || !u.login) continue
    users.push({
      id: u.id != null ? String(u.id) : u.login,
      username: u.login,
      displayName: u.login,
      avatarUrl: typeof u.avatar_url === 'string' ? u.avatar_url : '',
      isVerified: false,
      isPrivate: false,
    })
  }
  return users
}

export const githubAdapter: PlatformAdapter = {
  id: 'github',
  label: 'GitHub',
  mode: 'dom',
  hostnames: ['github.com'],
  scrollBehavior: 'paginated',
  usernameFromUrl: currentUsername,

  // GitHub's list is a plain server-rendered page, not a modal — no click
  // simulation needed, a normal navigation to the ?tab= URL is exactly what
  // clicking "Followers"/"Following" on the page itself would do.
  openList(direction) {
    const username = currentUsername()
    if (!username) return false
    if (new URLSearchParams(location.search).get('tab') === direction) return true
    window.location.href = `${location.pathname}?tab=${direction}`
    return true
  },

  detectListPage(location) {
    const pathMatch = location.pathname.match(PROFILE_LINK_RE)
    if (!pathMatch) return null

    const tab = new URLSearchParams(location.search).get('tab')
    if (tab !== 'followers' && tab !== 'following') return null

    return { accountId: pathMatch[1], accountUsername: pathMatch[1], direction: tab }
  },

  parseDom(root, page) {
    // Scoped the same way instagram.ts scopes to its dialog, and for the same
    // reason: `report()` hands this the whole document, where GitHub's global
    // header and footer also contain single-segment profile links sitting next
    // to an avatar image — the signed-in viewer's own profile link among them.
    // Those match every test a real row does, so an unscoped pass can quietly
    // add the viewer (or a sponsor/nav account) to someone else's follower
    // list. `main` is where the list itself lives; the fallback keeps this
    // working if it is ever absent, and for the unit tests below, which pass a
    // bare list fragment.
    const scoped = collectListRows(root.querySelector?.('main') ?? null, page)
    return scoped.length > 0 ? scoped : collectListRows(root, page)
  },

  // Reused by self-fetch below to parse GitHub's own API responses — never
  // reached via the passive fetch/XHR-interception path since this adapter
  // has no matchRequest (there's no page-triggered JSON request to observe).
  parseUsers: parseGithubListUsers,
  parseHasMore: parseGithubHasMore,

  selfFetch: {
    buildProfileUrl: buildGithubProfileUrl,
    parseProfile: parseGithubProfile,
    buildListUrl: buildGithubListUrl,
    parseNextCursor: parseGithubNextCursor,
    // Public, unauthenticated, read-only API — no session cookie, no CSRF, no
    // referrer expected. `Accept` is deliberately the only header: it's
    // CORS-safelisted, so these requests stay simple GETs. GitHub's documented
    // `X-GitHub-Api-Version` pin used to be sent alongside it, but that header
    // is not safelisted and would force a preflight on every request from the
    // page's MAIN world — GitHub's preflight response does not allow it, so the
    // pin cost the whole request rather than just itself. The API's default
    // version applies instead.
    requestHeaders: () => ({
      Accept: 'application/vnd.github+json',
    }),
    // Cross-origin public API: it answers `Access-Control-Allow-Origin: *`,
    // which a credentialed request can't use (unlike Instagram's same-origin
    // private API, which needs the session cookie).
    credentials: 'omit',
    pageSize: GITHUB_SELF_FETCH_PAGE_SIZE,
    minDelayMs: GITHUB_SELF_FETCH_MIN_DELAY_MS,
    maxDelayMs: GITHUB_SELF_FETCH_MAX_DELAY_MS,
  },
}

/** The list rows inside one scope — see `parseDom` for why the scope matters. */
function collectListRows(scope: ParentNode | null, page: Pick<DomListPage, 'accountId'>): SocialUser[] {
  if (!scope) return []
  const anchors = scope.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')
  const seen = new Set<string>()
  const users: SocialUser[] = []

  anchors.forEach((anchor) => {
    const match = anchor.getAttribute('href')?.match(PROFILE_LINK_RE)
    if (!match) return

    const username = match[1]
    const lower = username.toLowerCase()
    if (seen.has(lower) || RESERVED_ROUTES.has(lower) || lower === page.accountId.toLowerCase()) return

    // Only anchors that sit next to an avatar are list rows — this filters
    // out unrelated profile links (nav, mentions, etc.) on the same page.
    // Scoped to the immediate parent rather than closest('div'): an
    // unbounded ancestor walk matches whatever large container div wraps
    // the whole list, so its querySelector('img') would find some row's
    // avatar for every anchor on the page, not just real list rows.
    const avatar = anchor.querySelector('img') ?? anchor.parentElement?.querySelector('img')
    if (!avatar) return

    seen.add(lower)
    users.push({
      id: username,
      username,
      displayName: anchor.textContent?.trim() || username,
      avatarUrl: avatar.getAttribute('src') ?? '',
      isVerified: false,
      isPrivate: false,
    })
  })

  return users
}
