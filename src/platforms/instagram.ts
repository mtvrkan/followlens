import { debugLog, isDebugLoggingEnabled } from '../shared/debug'
import type { DomListPage, FriendshipDirection, PlatformAdapter, SelfFetchProfile, SocialUser } from './types'

// This reads the rendered followers/following dialog directly rather than
// intercepting Instagram's network responses. Two things vary across
// Instagram builds and are both handled below:
//  - Opening the dialog sometimes reflects in the URL (/user/followers/) and
//    sometimes leaves it on the plain /user/ path.
//  - The list is rendered inside a modal (role="dialog"); everything is
//    scoped to that modal so the feed behind it and sidebar suggestions
//    aren't mistaken for list rows.
const SINGLE_SEGMENT_RE = /^\/([A-Za-z0-9._]+)\/?$/
const LIST_URL_RE = /^\/([A-Za-z0-9._]+)\/(followers|following)\/?$/

// Instagram's own reserved top-level routes — real usernames can never be
// registered as one of these, so any single-segment role="link" anchor that
// happens to match one (nav bar, footer) is a false positive, not a row.
// Best-effort list; if Instagram adds a new reserved route this doesn't know
// about, it would need to be added here too.
const RESERVED_ROUTES = new Set([
  'explore', 'reels', 'reel', 'direct', 'accounts', 'stories', 'archive',
  'legal', 'web', 'popular', 'p', 'tv', 'developer', 'about', 'challenge',
  'session', 'graphql', 'api', 'ads', 'business', 'help', 'privacy',
  'terms', 'download', 'create', 'emails', 'settings', 'topics',
  'locations', 'hashtag', 'tags', 'live', 'lite',
])

// Which list was last opened by a user click — the direction signal on builds
// where opening the dialog doesn't change the URL. Set in init().
let lastClickedDirection: FriendshipDirection | null = null

// Every re-click `openList` still has queued (see `cancelPendingOpen` in
// platforms/types.ts). Tracked rather than fired-and-forgotten so stopping a
// scan — or superseding one open with another — can abandon them instead of
// having the dialog spring open a second or two after the user pressed Stop.
let pendingOpenTimers: ReturnType<typeof setTimeout>[] = []

function scheduleOpenStep(step: () => void, delayMs: number): void {
  pendingOpenTimers.push(setTimeout(step, delayMs))
}

function cancelPendingOpen(): void {
  for (const timer of pendingOpenTimers) clearTimeout(timer)
  pendingOpenTimers = []
}

// The username from wherever we currently are — the plain profile page
// (/user/) or an already-open list (/user/followers/, /user/following/) —
// so openList() can navigate there directly without needing the profile
// header to be on screen.
function currentUsername(): string | null {
  const match = location.pathname.match(LIST_URL_RE) ?? location.pathname.match(SINGLE_SEGMENT_RE)
  const username = match?.[1]
  if (!username || RESERVED_ROUTES.has(username.toLowerCase())) return null
  return username
}

// The profile header always lists posts/followers/following in that fixed
// order regardless of UI language — confirmed on a live Turkish-language
// account, where the two stat links read "130 takipçi" and "155 takip" but
// carry no distinguishing href (both "#"). Matching on "starts with a
// digit" instead of the (localized) label text keeps this language-agnostic:
// the first such link is always followers, the second always following.
function textOf(el: Element): string {
  return [el.textContent, el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('href')]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}

function directionFromElement(el: Element): FriendshipDirection | null {
  const text = textOf(el)
  const followerPattern = /takip(?:\u00e7i|ci|\u00c3\u00a7i)(?:ler)?/g
  const hasFollowers = /\/followers\/?$/.test(text) || /\bfollowers?\b/.test(text) || followerPattern.test(text)
  const followingText = text.replace(followerPattern, '')
  const hasFollowing =
    /\/following\/?$/.test(text) ||
    /\bfollowing\b/.test(text) ||
    /takip\s+edilen/.test(followingText) ||
    /takip\s+ettik/.test(followingText) ||
    /\btakip\b/.test(followingText)
  if (hasFollowers && hasFollowing) return null
  if (hasFollowers) return 'followers'
  if (hasFollowing) return 'following'
  return null
}

function statContainer(el: HTMLElement, direction: FriendshipDirection, header: HTMLElement): HTMLElement {
  let candidate = el
  while (candidate.parentElement && candidate.parentElement !== header && header.contains(candidate.parentElement)) {
    const parent = candidate.parentElement
    if (directionFromElement(parent) !== direction || !/\d/.test(parent.textContent ?? '')) break
    candidate = parent
  }
  return candidate
}

function clickableTarget(el: HTMLElement, direction: FriendshipDirection, header: HTMLElement): HTMLElement {
  const container = statContainer(el, direction, header)
  const direct = container.closest<HTMLElement>('a, button, [role="link"], [role="button"], [tabindex]')
  if (direct && header.contains(direct) && directionFromElement(direct) === direction) return direct
  const nested = container.querySelector<HTMLElement>('a, button, [role="link"], [role="button"], [tabindex]')
  if (nested && directionFromElement(nested) === direction) return nested
  return container
}

// Surfaces what the click-based open path is actually seeing on the real
// page — the header/DOM shape has changed under us before, and re-guessing
// blind after every report costs a full round trip. Prefixed for easy
// filtering in DevTools (F12 → Console → filter "FollowLens").
function findStatControls(): HTMLElement[] {
  const header = document.querySelector('header')
  if (!header) {
    debugLog('findStatControls: no <header> element on the page')
    return []
  }

  const byDirection: Partial<Record<FriendshipDirection, HTMLElement>> = {}
  for (const el of [...header.querySelectorAll<HTMLElement>('a, button, [role="link"], [role="button"], [tabindex], span, div')]) {
    const direction = directionFromElement(el)
    if (direction && !byDirection[direction]) byDirection[direction] = clickableTarget(el, direction, header)
  }
  if (byDirection.followers && byDirection.following) {
    // Guarded, not just passed to debugLog: `outerHTML` serializes the whole
    // node before `.slice` ever runs, and this function is on two hot paths
    // (every click on the page, every DOM report during a scan).
    if (isDebugLoggingEnabled()) {
      debugLog('findStatControls: matched by text', {
        followers: byDirection.followers.outerHTML.slice(0, 200),
        following: byDirection.following.outerHTML.slice(0, 200),
      })
    }
    return [byDirection.followers, byDirection.following]
  }

  const numericLeaves = [...header.querySelectorAll<HTMLElement>('a, button, [role="link"], [role="button"], [tabindex], span, div')].filter((el) =>
    /^\d/.test(el.textContent?.trim() ?? '') &&
    ![...el.children].some((child) => /^\d/.test(child.textContent?.trim() ?? '')),
  )
  const followerAndFollowing = numericLeaves.length > 2 ? numericLeaves.slice(-2) : numericLeaves
  // `header.outerHTML` is the whole profile header — by far the most
  // expensive thing this file used to build unconditionally.
  if (isDebugLoggingEnabled()) {
    debugLog('findStatControls: text match failed, falling back to numeric leaves', {
      headerHTML: header.outerHTML.slice(0, 600),
      numericLeafCount: numericLeaves.length,
      picked: followerAndFollowing.map((el) => el.outerHTML.slice(0, 150)),
    })
  }
  return followerAndFollowing.map((el, index) => clickableTarget(el, index === 0 ? 'followers' : 'following', header))
}

function statControlFor(direction: FriendshipDirection): HTMLElement | null {
  const controls = findStatControls()
  return controls[direction === 'followers' ? 0 : 1] ?? null
}

// Reads the exact number off a stat control's own text ("131 takipçi" -> 131).
// A short (<=3 letter) token right after the digits is Instagram's own
// abbreviation suffix on a rounded count ("12,3 B takipçi") — that number is
// an approximation, not exact, so it's rejected rather than risk cutting a
// scan short (or spinning forever chasing a target it'll never exactly hit).
function parseHeaderCount(el: HTMLElement): number | null {
  const tokens = (el.textContent ?? '').trim().split(/\s+/)
  const digits = tokens[0]
  if (!digits || !/^[\d.,]+$/.test(digits)) return null
  const unit = tokens[1]
  if (unit && /^[a-zçğıöşü]{1,3}$/i.test(unit)) return null
  const value = Number(digits.replace(/[.,]/g, ''))
  return Number.isFinite(value) && value > 0 ? value : null
}

function statIndexForElement(el: Element): number {
  return findStatControls().findIndex((control) => control === el || control.contains(el) || el.contains(control))
}

// Exactly one 'click' must fire — this used to also dispatch a manual
// 'click' MouseEvent *and* Enter/Space keydown/keyup before calling
// el.click(), so a single logical tap fired the click handler 2-3 times in
// the same synchronous tick. A toggle-style open handler (setOpen(o => !o))
// nets that back to closed, which is exactly the open/don't-open
// inconsistency seen in practice — the pointer events below simulate the
// physical press without triggering activation themselves, and el.click()
// is the one real activation.
function clickLikeUser(el: HTMLElement): void {
  el.scrollIntoView?.({ block: 'center', inline: 'center' })
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
  }
  // SVGElement doesn't reliably implement .click() the way HTMLElement does
  // (an aria-label sitting directly on an <svg> icon, rather than the
  // button/div wrapping it, matches el below but has no .click) — this
  // crashed openList()'s synchronous body outright, which silently aborted
  // the whole followers→following switch since nothing downstream caught it.
  el.click?.()
}

function findCloseButton(dialog: HTMLElement): HTMLElement | null {
  for (const el of dialog.querySelectorAll<HTMLElement>('[aria-label]')) {
    if (!/close|kapat/i.test(el.getAttribute('aria-label') ?? '')) continue
    // The label is commonly on the icon (often an <svg>, which may lack
    // .click()) rather than its clickable wrapper — prefer the nearest real
    // interactive ancestor when there is one.
    const clickable = el.closest<HTMLElement>('button, [role="button"], a, [tabindex]') ?? el
    if (typeof clickable.click === 'function') return clickable
  }
  return null
}

function closeDialog(): void {
  // A real click (clickLikeUser -> el.click()) is the one activation we've
  // confirmed Instagram's handlers reliably act on — try the dialog's own
  // close button with that before falling back to a synthetic Escape, which
  // depends on a document-level keydown listener that may not be attached,
  // or may ignore a non-trusted KeyboardEvent altogether.
  const dialog = getListDialog()
  const button = dialog && findCloseButton(dialog)
  if (button) {
    clickLikeUser(button)
    return
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }))
  document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Escape' }))
}

// The followers/following list renders inside a modal dialog. Its presence is
// what tells us a list is actually open (the header stats behind it are always
// in the DOM, so their existence alone proves nothing).
function getListDialog(): HTMLElement | null {
  const dialogs = [...document.querySelectorAll<HTMLElement>('div[role="dialog"]')]
  // querySelector's "first match" isn't safe here: Instagram doesn't always
  // remove a closed dialog's element from the DOM (mid CSS transition, or
  // just left mounted), so the first followers/following dialog ever opened
  // can permanently win every lookup afterwards, freezing detection (and
  // dialogDirection's title read) on stale content. Walk from the end
  // (newest-mounted first) and take the first one that's actually visible.
  for (let i = dialogs.length - 1; i >= 0; i--) {
    const el = dialogs[i]
    if (el.getAttribute('aria-hidden') === 'true') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    return el
  }
  return dialogs[0] ?? null
}

// Reads the dialog's own title ("Takipçiler" / "Takip Ettikleri",
// "Followers" / "Following") as ground truth for which list is open. This
// replaces trusting lastClickedDirection alone while a dialog is up: that's
// just "which control did we click last", tracked across async click/retry
// timers racing an independent MutationObserver — a mutation firing in the
// gap between closeDialog() and the new dialog's content settling could see
// the OLD dialog's rows with the NEW direction already assumed, mislabeling
// (and duplicating) one list's rows into the other's buffer. The title is
// authoritative regardless of timing: whatever's rendered right now IS what
// Instagram says this dialog is.
function dialogTitleText(dialog: HTMLElement): string {
  const heading = dialog.querySelector<HTMLElement>('[role="heading"], h1, h2, h3, h4')
  if (heading?.textContent?.trim()) return heading.textContent
  const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim()
    if (text) return text
  }
  return ''
}

function dialogDirection(dialog: HTMLElement): FriendshipDirection | null {
  const text = dialogTitleText(dialog).toLocaleLowerCase()
  debugLog('dialogDirection: title text', text)
  if (/takip\s*ettik|takip\s*edilen|\bfollowing\b/.test(text)) return 'following'
  if (/takipç|takipc|\bfollowers?\b/.test(text)) return 'followers'
  return null
}

function usernameFromHref(href: string | null): string | null {
  if (!href) return null
  try {
    const url = new URL(href, 'https://www.instagram.com')
    if (!href.startsWith('/') && !/(^|\.)instagram\.com$/i.test(url.hostname)) return null
    const match = url.pathname.match(SINGLE_SEGMENT_RE)
    const username = match?.[1]
    if (!username || RESERVED_ROUTES.has(username.toLowerCase())) return null
    return username
  } catch {
    return null
  }
}

function profileAnchors(scope: ParentNode, page: DomListPage): HTMLAnchorElement[] {
  const owner = page.accountId.toLowerCase()
  return [...scope.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((anchor) => {
    const username = usernameFromHref(anchor.getAttribute('href'))
    return !!username && username.toLowerCase() !== owner
  })
}

// Instagram's legacy private-API endpoint for the followers/following list —
// the same one its own web client's XHR calls hit while scrolling the
// dialog. Read directly (in addition to, not instead of, the DOM scrape
// above): the dialog's rows are virtualized, and a MutationObserver reading
// the DOM can land between two rendered batches and silently miss whichever
// one was swapped out first — confirmed live, repeated scans of the same
// account each captured a different, non-overlapping ~85% of the real list.
// The network response has no such gap: it's exactly what Instagram itself
// fetched, independent of what's currently rendered.
const FRIENDSHIP_API_RE = /\/api\/v1\/friendships\/(\d+)\/(followers|following)\/?(?:[?#]|$)/

interface FriendshipApiUser {
  pk?: number | string
  id?: number | string
  username?: string
  full_name?: string
  profile_pic_url?: string
  is_verified?: boolean
  is_private?: boolean
}

function likelyListScope(root: ParentNode, page: DomListPage): ParentNode {
  const dialog = getListDialog()
  if (dialog) return dialog

  let best: ParentNode = root
  let bestCount = profileAnchors(root, page).length
  root.querySelectorAll?.('main, section, div, ul').forEach((el) => {
    const count = new Set(profileAnchors(el, page).map((anchor) => usernameFromHref(anchor.getAttribute('href')))).size
    if (count > bestCount) {
      best = el
      bestCount = count
    }
  })
  return best
}

// --- Self-fetch: an opt-in, deliberate exception to "never issue our own
// request" (see PlatformAdapter.selfFetch's doc comment). Directly
// paginating Instagram's private list API sidesteps every DOM-scroll
// failure mode confirmed live above (virtualization gaps, non-overlapping
// passes, the suggested-accounts strip inflating counts past the real
// total) since it never touches rendered rows at all — it fetches exactly
// what the page's own JS would eventually fetch anyway, just walked to
// completion by us instead of by scrolling. The actual fetch() calls run in
// the MAIN-world injected script (same-origin, page's own session cookies);
// everything here is pure URL-building/parsing, no side effects.

// Instagram's web client's own numeric app id, sent as X-IG-App-ID on every
// private-API request from the browser — a long-stable public constant (not
// a secret; every visitor's browser sends the same value), required for
// these endpoints to respond instead of rejecting the request outright.
const IG_APP_ID = '936619743392459'

// Matches the real page size captured live from Instagram's own web client
// (count=12) exactly, rather than the earlier count=100 this used to send.
// The larger size was meant to finish faster, but no organic browser
// request to this endpoint has ever been seen asking for anywhere near that
// many rows at once — it's a strong, easy-to-flag tell that the request
// didn't come from someone actually scrolling the dialog. Slower but far
// less distinguishable from real traffic is the right trade here.
const SELF_FETCH_PAGE_SIZE = 12
// Wide, irregular range on purpose — a bot firing every ~800ms±50ms is a
// documented detection signal precisely because real pauses between a
// user's scroll-triggered loads vary far more than that.
const SELF_FETCH_MIN_DELAY_MS = 900
const SELF_FETCH_MAX_DELAY_MS = 3200

function buildProfileUrl(username: string): string {
  return `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
}

// Confirmed live: web_profile_info responds with just X-IG-App-ID, but the
// legacy friendships list endpoint below rejects that alone — it 200s with
// the plain HTML app shell instead of JSON (silently, no error status)
// unless the request also carries the CSRF token Instagram's own web client
// echoes back as a header on every private-API call. The token itself isn't
// secret; it's read straight out of the (non-httpOnly, JS-readable-by-design)
// `csrftoken` cookie the exact same way the page's own bundle does.
function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function parseProfile(json: unknown): SelfFetchProfile | null {
  if (!json || typeof json !== 'object') return null
  const data = json as { data?: { user?: unknown } }
  const user = data.data?.user
  if (!user || typeof user !== 'object') return null
  const u = user as { id?: unknown; edge_followed_by?: { count?: unknown }; edge_follow?: { count?: unknown } }
  if (typeof u.id !== 'string' && typeof u.id !== 'number') return null
  const followers = u.edge_followed_by?.count
  const following = u.edge_follow?.count
  return {
    pk: String(u.id),
    followers: typeof followers === 'number' ? followers : null,
    following: typeof following === 'number' ? following : null,
  }
}

// `search_surface=follow_list_page` was present on the real followers
// request captured live from Instagram's own web client
// (.../followers/?count=12&search_surface=follow_list_page) but absent from
// its following request (.../following/?count=12) — mirrored exactly as
// observed rather than guessed, since Instagram may use it to distinguish a
// request as coming from the genuine follow-list UI surface.
function buildListUrl(pk: string, direction: FriendshipDirection, cursor: string | null): string {
  const surface = direction === 'followers' ? '&search_surface=follow_list_page' : ''
  const base = `https://www.instagram.com/api/v1/friendships/${pk}/${direction}/?count=${SELF_FETCH_PAGE_SIZE}${surface}`
  return cursor ? `${base}&max_id=${encodeURIComponent(cursor)}` : base
}

function parseNextCursor(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const data = json as { next_max_id?: unknown }
  return typeof data.next_max_id === 'string' && data.next_max_id ? data.next_max_id : null
}

export const instagramAdapter: PlatformAdapter = {
  id: 'instagram',
  label: 'Instagram',
  mode: 'dom',
  hostnames: ['instagram.com'],
  scrollBehavior: 'infinite',
  usernameFromUrl: currentUsername,

  // Supplementary to the DOM scrape below, not a replacement — see the
  // comment on FRIENDSHIP_API_RE. mode stays 'dom' since openList/parseDom
  // still own opening the dialog and scrolling it; this just adds a second,
  // more reliable source for who's actually in the list.
  matchRequest(url) {
    const match = url.match(FRIENDSHIP_API_RE)
    if (!match) return null
    return { accountId: match[1], direction: match[2] as FriendshipDirection }
  },

  parseUsers(json) {
    if (!json || typeof json !== 'object') return []
    const data = json as { users?: unknown[] }
    if (!Array.isArray(data.users)) return []

    const users: SocialUser[] = []
    for (const raw of data.users) {
      if (!raw || typeof raw !== 'object') continue
      const u = raw as FriendshipApiUser
      if (typeof u.username !== 'string' || !u.username) continue

      const id = u.pk != null ? String(u.pk) : u.id != null ? String(u.id) : u.username
      users.push({
        id,
        username: u.username,
        displayName: (typeof u.full_name === 'string' && u.full_name) || u.username,
        avatarUrl: typeof u.profile_pic_url === 'string' ? u.profile_pic_url : '',
        isVerified: u.is_verified === true,
        isPrivate: u.is_private === true,
      })
    }
    return users
  },

  parseHasMore(json) {
    if (!json || typeof json !== 'object') return null
    const data = json as { has_more?: unknown }
    return typeof data.has_more === 'boolean' ? data.has_more : null
  },

  init() {
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as Element | null
        if (!target) return
        // Cheap early-out before the full header scan below. This listener
        // sees every click on the page — feed, posts, comments, the dialog
        // itself — and findStatControls() only ever returns elements inside
        // <header>, so a click with no containment relationship to the header
        // can never match one. Without this, every click anywhere on
        // Instagram ran a broad querySelectorAll plus a handful of regexes
        // per matched element, for the whole life of the tab, whether or not
        // a scan was ever started. Both containment directions are kept
        // because statIndexForElement itself matches either way.
        const header = document.querySelector('header')
        if (!header || !(header.contains(target) || target.contains(header))) return
        const index = statIndexForElement(target)
        if (index === 0) lastClickedDirection = 'followers'
        else if (index === 1) lastClickedDirection = 'following'
      },
      true,
    )
  },

  openList(direction) {
    // This call supersedes whatever the previous one still had queued —
    // otherwise a reopen (scrollDirectionToCompletion retries by closing and
    // reopening) races its own predecessor's re-clicks.
    cancelPendingOpen()

    const username = currentUsername()
    if (!username) {
      debugLog('openList: no username in URL', location.pathname)
      return false
    }
    const currentList = location.pathname.match(LIST_URL_RE)
    if (currentList?.[1] === username && currentList[2] === direction) {
      lastClickedDirection = direction
      return true
    }
    if (getListDialog() && lastClickedDirection === direction) return true

    const control = statControlFor(direction)
    if (!control) {
      debugLog('openList: no clickable control found for', direction)
      return false
    }
    debugLog('openList: clicking control for', direction, control.outerHTML.slice(0, 200))

    // When switching from an already-open list of the OTHER direction,
    // lastClickedDirection must NOT flip to the new one yet: report() runs
    // off a MutationObserver that fires independently of this click, and
    // between closeDialog() and the new dialog actually mounting, the old
    // dialog's rows are still what's on screen. If detectListPage already
    // claims the new direction at that point, report() reads those stale
    // rows as if they belonged to it — duplicating followers into following
    // (or vice versa). Clearing it makes detectListPage return null (no
    // page) for that gap instead of mislabeling what's still showing.
    if (getListDialog() && lastClickedDirection !== direction) lastClickedDirection = null

    const tryClick = () => {
      if (getListDialog()) {
        closeDialog()
        scheduleOpenStep(() => {
          clickLikeUser(control)
          lastClickedDirection = direction
        }, 350)
      } else {
        clickLikeUser(control)
        lastClickedDirection = direction
      }
    }

    tryClick()
    // No page navigation on purpose — a full reload would abandon a click
    // that just needed a bit more time, reset the content script's
    // in-memory state, and reads as unusual traffic. Some builds' React
    // handlers miss the first dispatched (non-trusted) click, so just
    // re-click a couple more times if the dialog still isn't open.
    for (const delay of [1200, 2600]) {
      scheduleOpenStep(() => {
        if (!getListDialog()) {
          debugLog(`openList: dialog still not open ${delay}ms after click, retrying`, direction)
          tryClick()
        } else if (lastClickedDirection === direction) {
          debugLog('openList: dialog is open', direction)
        }
      }, delay)
    }
    return true
  },

  closeList() {
    // Closing while a re-click is still queued would just have it reopened a
    // moment later.
    cancelPendingOpen()
    if (getListDialog()) closeDialog()
  },

  cancelPendingOpen,

  expectedCount(direction) {
    const control = statControlFor(direction)
    return control ? parseHeaderCount(control) : null
  },

  detectListPage(location): DomListPage | null {
    // Prefer the URL when Instagram reflects the open list there — it names
    // the direction unambiguously, can't go stale, and (unlike the fallback
    // below) doesn't depend on a modal dialog being on screen, which a
    // freshly-navigated (not clicked-into) list page may or may not render.
    const listMatch = location.pathname.match(LIST_URL_RE)
    if (listMatch) {
      return { accountId: listMatch[1], accountUsername: listMatch[1], direction: listMatch[2] as FriendshipDirection }
    }

    // Builds where opening the dialog doesn't change the URL: a list is only
    // "open" while its modal is genuinely on screen. Without this guard,
    // background page mutations keep matching a stale direction and the
    // whole page gets re-scanned as followers.
    const dialog = getListDialog()
    if (!dialog) return null
    const single = location.pathname.match(SINGLE_SEGMENT_RE)
    if (!single) return null
    const direction = dialogDirection(dialog) ?? lastClickedDirection
    if (!direction) return null
    return { accountId: single[1], accountUsername: single[1], direction }
  },

  parseDom(root, page): SocialUser[] {
    // Scope strictly to the modal's list. Scanning the whole page pulls in the
    // feed behind the modal, sidebar suggestions and nav links — the cause of
    // wildly inflated follower counts. Falls back to `root` when no dialog is
    // present (unit tests pass a list fragment directly).
    const scope = likelyListScope(root, page)
    const anchors = profileAnchors(scope, page)
    const seen = new Set<string>()
    const users: SocialUser[] = []

    anchors.forEach((anchor) => {
      const username = usernameFromHref(anchor.getAttribute('href'))
      if (!username) return
      const lower = username.toLowerCase()
      if (seen.has(lower) || RESERVED_ROUTES.has(lower) || lower === page.accountId.toLowerCase()) return
      seen.add(lower)

      // Best-effort: avatar/display-name markup isn't confirmed against live
      // Instagram (a working reference scraper we checked doesn't extract
      // them either), so both degrade gracefully rather than dropping the
      // row — the username, which drives everything else, comes straight
      // from the href and is reliable.
      const avatar = anchor.querySelector('img') ?? anchor.parentElement?.querySelector('img')
      const displayName =
        [...(anchor.parentElement?.querySelectorAll('span') ?? [])]
          .map((el) => el.textContent?.trim())
          .find((text) => text && text.toLowerCase() !== lower) || username

      users.push({
        id: username,
        username,
        displayName,
        avatarUrl: avatar?.getAttribute('src') ?? '',
        isVerified: false,
        isPrivate: false,
      })
    })

    return users
  },

  selfFetch: {
    buildProfileUrl,
    parseProfile,
    buildListUrl,
    parseNextCursor,
    requestHeaders: () => ({
      'X-IG-App-ID': IG_APP_ID,
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': readCookie('csrftoken'),
    }),
    // Some of Instagram's legacy private-API endpoints have been seen
    // validating this in addition to the CSRF header — mimics the referrer a
    // real page navigation to the list would carry.
    buildReferrer: (accountId, direction) => `https://www.instagram.com/${accountId}/${direction}/`,
    pageSize: SELF_FETCH_PAGE_SIZE,
    minDelayMs: SELF_FETCH_MIN_DELAY_MS,
    maxDelayMs: SELF_FETCH_MAX_DELAY_MS,
  },
}
