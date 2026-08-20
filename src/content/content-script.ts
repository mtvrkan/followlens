// Runs in the isolated content script world. Drives the two supported
// platforms (Instagram, GitHub) by reading the rendered list off the page, and
// bridges what the MAIN-world injected script sends over — intercepted list
// responses and self-fetch progress — to the background service worker.
//
// A few branches below are written against capabilities no current adapter
// declares (a JSON-only platform with no parseDom, an adapter with no
// openList). They are kept as the honest handling of an adapter shape the
// PlatformAdapter type still permits, not as support for anything shipping.
//
// Collection is split in two:
//  - Passive: whatever the user loads by browsing/scrolling themselves is
//    always reported to the background. No page interaction happens.
//  - Active (auto-scroll / pagination): ONLY runs after an explicit start
//    from the popup, with a visible on-page indicator and a stop button.

import { getAdapterForHost, getDomAdapterForHost } from '../platforms/registry'
import {
  isGetScanStateMessage,
  isResetCollectedMessage,
  isScanControlMessage,
  isSelfFetchCountsMessage,
  isSelfFetchDoneMessage,
  isSelfFetchFailedMessage,
  isWindowMessage,
  sendRuntimeMessage,
} from '../shared/messages'
import { ok } from '../shared/result'
import { debugLog, initDebugLoggingFromStorage, isDebugLoggingEnabled } from '../shared/debug'
import { isSelfFetchAllowed, SELF_FETCH_COOLDOWN_KEY_PREFIX } from '../shared/settings'
import { hideIndicator, showIndicator, updateIndicatorCount } from './indicator'
import { findNextPageLink } from './next-page'
import type { FriendshipDirection, PlatformId, SocialUser } from '../platforms/types'

// Resolves the user's "debug logging" setting and mirrors it into the DOM for
// the MAIN-world injected script, which has no chrome.storage of its own.
initDebugLoggingFromStorage()

// --- Collection controller ---------------------------------------------------

// Persisted per-tab (survives GitHub's full-page pagination and Instagram's
// followers→following direction-switch navigations — see `reportOpenList`
// below — and nothing else): sessionStorage is scoped to this tab and
// cleared with it.
const COLLECTING_FLAG = 'followlens-collecting'
const GUIDED_DIRECTION_KEY = 'followlens-guided-direction'
const GUIDED_OPEN_ATTEMPTS_KEY = 'followlens-guided-open-attempts'
const GUIDED_OPENED_DIRECTIONS_KEY = 'followlens-guided-opened-directions'
// Which paginated list URLs this tab has already walked. Each step is a full
// page load, so an in-memory set would be wiped every time — the loop guard
// in findNextPageLink only means anything if it survives the navigation it is
// guarding.
const VISITED_PAGES_KEY = 'followlens-visited-pages'
// A list long enough to exceed this is far past what the DOM fallback
// realistically walks; the cap just keeps sessionStorage from growing without
// bound on a very long run.
const MAX_VISITED_PAGES = 300

function readPersistedCollecting(): boolean {
  try {
    return sessionStorage.getItem(COLLECTING_FLAG) === '1'
  } catch {
    return false
  }
}

function readGuidedDirection(): FriendshipDirection | null {
  try {
    const value = sessionStorage.getItem(GUIDED_DIRECTION_KEY)
    return value === 'followers' || value === 'following' ? value : null
  } catch {
    return null
  }
}

function writeGuidedDirection(direction: FriendshipDirection | null): void {
  try {
    const previous = sessionStorage.getItem(GUIDED_DIRECTION_KEY)
    if (direction) {
      sessionStorage.setItem(GUIDED_DIRECTION_KEY, direction)
      if (previous !== direction) sessionStorage.setItem(GUIDED_OPEN_ATTEMPTS_KEY, '0')
    } else {
      sessionStorage.removeItem(GUIDED_DIRECTION_KEY)
      sessionStorage.removeItem(GUIDED_OPEN_ATTEMPTS_KEY)
      sessionStorage.removeItem(GUIDED_OPENED_DIRECTIONS_KEY)
      // Part of the same "this sequence is over" reset: a fresh scan must be
      // able to walk the same pages again.
      sessionStorage.removeItem(VISITED_PAGES_KEY)
    }
  } catch {
    // sessionStorage can be blocked by site settings — falls back to
    // treating every load as a fresh start, which is safe (just repeats
    // followers before moving on) rather than unsafe.
  }
}

function readGuidedOpenedDirections(): Set<FriendshipDirection> {
  try {
    const value = sessionStorage.getItem(GUIDED_OPENED_DIRECTIONS_KEY)
    const parsed = value ? JSON.parse(value) : []
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((item): item is FriendshipDirection => item === 'followers' || item === 'following'))
  } catch {
    return new Set()
  }
}

function hasGuidedOpenedDirection(direction: FriendshipDirection): boolean {
  return readGuidedOpenedDirections().has(direction)
}

function markGuidedOpenedDirection(direction: FriendshipDirection): void {
  try {
    const opened = readGuidedOpenedDirections()
    opened.add(direction)
    sessionStorage.setItem(GUIDED_OPENED_DIRECTIONS_KEY, JSON.stringify([...opened]))
  } catch {
    // If sessionStorage is unavailable, the in-memory guidedFlowActive guard
    // still prevents duplicate opens in the current page lifecycle.
  }
}

function readVisitedPages(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(VISITED_PAGES_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set()
  }
}

function markVisitedPage(url: string): void {
  try {
    const visited = readVisitedPages()
    visited.add(url)
    sessionStorage.setItem(VISITED_PAGES_KEY, JSON.stringify([...visited].slice(-MAX_VISITED_PAGES)))
  } catch {
    // sessionStorage can be blocked by site settings — the walk then falls
    // back to findNextPageLink's same-URL check alone, which still refuses to
    // navigate to the page it is already on.
  }
}

function readGuidedOpenAttempts(): number {
  try {
    const value = Number(sessionStorage.getItem(GUIDED_OPEN_ATTEMPTS_KEY) ?? '0')
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function writeGuidedOpenAttempts(value: number): void {
  try {
    sessionStorage.setItem(GUIDED_OPEN_ATTEMPTS_KEY, String(value))
  } catch {
    // In-memory retry still happens for the current call chain.
  }
}

let collecting = false
// Set below, once, if a DOM adapter is active on this page — clears its
// "already reported this user" dedup memory so a RESET_BUFFER reset (which
// clears the background's copy) doesn't get silently undone by the content
// script re-suppressing everyone it already sent once.
let clearReportedDedup: (() => void) | null = null
// `true` once the guided followers→following sequence (see `reportOpenList`
// below) has scrolled both directions out — `null` for adapters with no such
// sequence, so the popup falls back to its own
// stall-based heuristic instead of waiting on a signal that will never arrive.
let guidedComplete: boolean | null = null
let guidedFlowActive = false

function setCollecting(next: boolean): void {
  if (next === collecting) return
  collecting = next
  // Only adapters with a guided open flow (openList) ever resolve this to
  // true — everyone else must stay null (per the comment on its
  // declaration) so the popup uses its stall heuristic instead of waiting
  // on a signal that will never arrive. This used to unconditionally set
  // `false` here regardless of adapter, which for GitHub/json-mode
  // platforms permanently pinned looksComplete's guided branch to false
  // (see Popup.tsx) instead of ever falling back to the heuristic.
  // Checked against pageAdapter (any mode), not just the dom-only
  // domAdapter, since a json-mode adapter could declare openList too.
  if (next) guidedComplete = pageAdapter?.openList ? false : null
  else {
    guidedFlowActive = false
    writeGuidedDirection(null)
    selfFetchCounts = null
    clearSelfFetchWatchdog()
    // Adapters that open a list by clicking retry that click on a timer
    // (Instagram). Those timers can't see `collecting`, so without
    // this a Stop pressed in the first couple of seconds of a scan was
    // followed by the dialog opening anyway — the page acting after the user
    // told it to stop. Same reasoning as the `collecting` re-check inside
    // goToNextPage's own delay below.
    pageAdapter?.cancelPendingOpen?.()
    // Harmless no-op if self-fetch never started (or isn't supported on this
    // platform) — the injected script just sets a flag it never reads again.
    window.postMessage({ source: 'followlens', type: 'STOP_SELF_FETCH' }, window.location.origin)
  }
  try {
    if (next) sessionStorage.setItem(COLLECTING_FLAG, '1')
    else sessionStorage.removeItem(COLLECTING_FLAG)
  } catch {
    // sessionStorage can be blocked by site settings — state stays in-memory.
  }

  if (next) {
    showIndicator(() => setCollecting(false))
    kickCollection()
  } else {
    hideIndicator()
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isScanControlMessage(message)) {
    if (message.action === 'start' && !collecting) writeGuidedDirection(null)
    setCollecting(message.action === 'start')
    sendResponse(ok({ collecting, guidedComplete }))
    return
  }
  if (isGetScanStateMessage(message)) {
    sendResponse(ok({ collecting, guidedComplete }))
    return
  }
  if (isResetCollectedMessage(message)) {
    clearReportedDedup?.()
    sendResponse(ok(null))
  }
})

// --- Durable avatars ----------------------------------------------------------

// Avatar URLs on every platform's CDN are commonly hotlink-protected against
// the referrer (rejecting anything that isn't the platform's own origin) and
// can carry a short-lived signed expiry — both of which make them fail to
// load later from the extension's own popup/dashboard pages. Converting to a
// data URL here, while we're still actually on the platform's page (so the
// browser's own request for it succeeds normally), makes the image durable.
// `force-cache` prefers whatever the browser already fetched to render the
// row's <img> instead of issuing a fresh network request.
const avatarCache = new Map<string, string>()

// Both caps keep a huge account's scan from ballooning storage: oversized
// images and everything past the cap keep their original URL instead
// (the Avatar component degrades to initials if that URL later expires).
const MAX_AVATAR_BLOB_BYTES = 64 * 1024
const MAX_CONVERTED_AVATARS = 2_000

async function toDurableAvatar(url: string): Promise<string> {
  if (!url) return url
  const cached = avatarCache.get(url)
  if (cached) return cached
  if (avatarCache.size >= MAX_CONVERTED_AVATARS) return url

  try {
    const response = await fetch(url, { cache: 'force-cache' })
    const blob = await response.blob()
    if (blob.size > MAX_AVATAR_BLOB_BYTES) return url
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
    avatarCache.set(url, dataUrl)
    return dataUrl
  } catch {
    return url
  }
}

async function withDurableAvatars(users: SocialUser[]): Promise<SocialUser[]> {
  return Promise.all(
    users.map(async (user) => (user.avatarUrl ? { ...user, avatarUrl: await toDurableAvatar(user.avatarUrl) } : user)),
  )
}

// --- Reporting to the background ---------------------------------------------

// Best-effort human-readable label for whichever account's list is open —
// the API only gives us a numeric id, so multiple accounts on the same
// platform would otherwise be indistinguishable in the UI.
function guessAccountLabel(): string | null {
  // The URL first — cheap, and available even before the page has finished
  // rendering the canonical link tag (the DOM-flow fallback this feeds into
  // exists mainly for that early-page-load window, so skipping it here
  // matters). link[rel="canonical"] is the fallback for platforms whose URL
  // doesn't carry the username directly.
  const fromUrl = pageAdapter?.usernameFromUrl?.()
  if (fromUrl) return fromUrl

  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href')
  if (!canonical) return null
  try {
    const segment = new URL(canonical).pathname.replace(/^\/|\/$/g, '').split('/')[0]
    return segment || null
  } catch {
    return null
  }
}

// A dropped report is not cosmetic. The self-fetch loop decides it is done by
// comparing its OWN running set of seen usernames against the profile's stated
// total — a set it adds to before handing the page over here. So a report that
// fails to reach the background leaves those users missing from the saved
// buffer while the loop still counts them and stops on schedule: the scan ends
// "complete" a few accounts short, with nothing anywhere saying why. The usual
// failure is the service worker being asleep, which a moment's wait fixes, so
// retry before giving up.
const REPORT_RETRY_DELAYS_MS = [150, 500, 1500]

async function reportUsers(
  platform: PlatformId,
  direction: FriendshipDirection,
  accountId: string,
  accountUsername: string | null,
  users: SocialUser[],
  expectedCount: number | null = null,
): Promise<void> {
  const usersWithDurableAvatars = await withDurableAvatars(users)

  for (let attempt = 0; ; attempt++) {
    const res = await sendRuntimeMessage({
      type: 'FRIENDSHIP_PAGE',
      platform,
      direction,
      accountId,
      accountUsername,
      users: usersWithDurableAvatars,
      expectedCount,
    })

    if (res.ok) {
      updateIndicatorCount(res.value.followers, res.value.following)
      return
    }

    // Out of retries, or the scan was stopped while waiting — the background
    // re-sends nothing on its own, so this page's users are genuinely lost.
    // Logged rather than silent so a short scan is at least diagnosable.
    if (attempt >= REPORT_RETRY_DELAYS_MS.length || !collecting) {
      console.error('[FollowLens] dropped a page of collected users:', res.error, { platform, direction, users: usersWithDurableAvatars.length })
      return
    }

    await sleep(REPORT_RETRY_DELAYS_MS[attempt])
  }
}

// The platform's own "is there more to fetch" signal (Instagram's `has_more`
// in the friendship API response), captured per direction as network
// responses arrive. Authoritative where present — scrollDirectionToCompletion
// trusts this over comparing a collected count against a profile header
// stat, which can be stale or count accounts that aren't actually
// enumerable (e.g. some blocked/deactivated ones).
const lastHasMoreByDirection = new Map<FriendshipDirection, boolean>()

// The platform's own exact total per direction, for adapters whose list
// response states one (`PlatformAdapter.parseTotal`). Preferred over the
// adapter's DOM scrape of the profile header, which platforms abbreviate once
// the number is large enough to matter. Neither current adapter defines
// parseTotal — Instagram's exact totals arrive via SELF_FETCH_COUNTS instead —
// so this stays empty today and the reads below fall through to their next
// source; kept because it is the response body's own figure, which is strictly
// better than a scraped header whenever an adapter does start providing it.
const lastTotalByDirection = new Map<FriendshipDirection, number>()

// Set from SELF_FETCH_COUNTS (the platform's own exact totals, read once up
// front by the self-fetch loop) — more reliable than a scraped profile-
// header stat, so it's threaded into reportUsers' expectedCount whenever
// present instead of falling through to the DOM adapter's own guess.
let selfFetchCounts: { followers: number | null; following: number | null } | null = null

// Guards against START_SELF_FETCH silently going nowhere (the MAIN-world
// injected script's own listener not attached yet, the postMessage getting
// dropped, or an uncaught error in that script breaking its response path
// before it ever posts back) — without this, a lost START message left the
// scan stuck at 0/0 forever with no fallback ever triggering, since the
// fallback below only runs in reaction to a SELF_FETCH_FAILED message that
// would never arrive. Cleared the moment any self-fetch response (success or
// failure) actually lands.
let selfFetchWatchdog: ReturnType<typeof setTimeout> | null = null

function clearSelfFetchWatchdog(): void {
  if (selfFetchWatchdog != null) {
    clearTimeout(selfFetchWatchdog)
    selfFetchWatchdog = null
  }
}

function fallBackFromSelfFetch(reason: string): void {
  clearSelfFetchWatchdog()
  selfFetchCounts = null
  debugLog(`self-fetch ${reason} — falling back to the DOM scroll flow`)
  reportOpenList?.()
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== window.location.origin) return

  if (isSelfFetchCountsMessage(event.data)) {
    clearSelfFetchWatchdog()
    selfFetchCounts = { followers: event.data.followers, following: event.data.following }
    return
  }
  if (isSelfFetchDoneMessage(event.data)) {
    clearSelfFetchWatchdog()
    selfFetchCounts = null
    guidedComplete = true
    setCollecting(false)
    return
  }
  if (isSelfFetchFailedMessage(event.data)) {
    startSelfFetchCooldown(event.data.platform)
    fallBackFromSelfFetch('reported failure')
    return
  }

  if (!isWindowMessage(event.data)) return

  const { platform, direction, accountId, users, hasMore, total } = event.data
  if (hasMore != null) lastHasMoreByDirection.set(direction, hasMore)
  if (total != null) lastTotalByDirection.set(direction, total)
  // Only ever report to the background while a scan is actively running —
  // otherwise Instagram's own passive network chatter (its JS quietly
  // re-fetching a page or two while the user is just glancing at a profile,
  // no scan ever started) would silently add that account to the picker.
  // Matching gate on the DOM-scrape side is in report() below.
  if (!collecting) return
  // This message's own accountId is Instagram's internal numeric id (pk) for
  // network-observed responses — a different identity space than the
  // username everything else here keys by (self-fetch, the DOM scrape, the
  // popup's own account selection). Left as-is, the same account gets
  // tracked under two different ids and shows up twice in the account
  // picker (confirmed live). Resolve to the current page's username instead,
  // same identity as every other source, whenever a DOM adapter (Instagram)
  // owns this host.
  const resolvedAccountId = domAdapter ? guessAccountLabel() ?? accountId : accountId
  reportUsers(
    platform,
    direction,
    resolvedAccountId,
    guessAccountLabel(),
    users,
    selfFetchCounts?.[direction] ?? lastTotalByDirection.get(direction) ?? null,
  )

  // The page just proved the followers/following list is open — keep loading
  // more. Skipped when a DOM-mode adapter owns this host (Instagram): its own
  // guided flow already drives autoScroll with a precise shouldStop target
  // (scrollDirectionToCompletion below) — this generic, no-target call is
  // only needed for a pure JSON-mode adapter, whose flow doesn't scroll
  // on its own. Calling it here too would race the two for autoScroll's
  // single-flight lock and could win it with no shouldStop, silently
  // dropping the DOM flow's stop condition for that in-flight call.
  if (!domAdapter) autoScroll()
})

// --- Auto-scroll: loads more rows by scrolling whatever container is showing
// the list. This only scrolls — it never calls the platform's API directly —
// so the resulting requests are the same ones the user's own scrolling makes.
// A single page-wide flag (not per-caller) — kickCollection's initial scroll
// and a report()-triggered scroll used to run concurrently under different
// keys, doubling scroll frequency and undermining the human-ish pacing below.
// There is only ever one scrollable list on screen, so only one loop should
// ever run regardless of who asked for it.
// 'reached-target' means shouldStop() was satisfied — a confident signal the
// list is actually done. 'gave-up' means it stopped on height stagnation or
// the iteration cap — the list might genuinely be exhausted, or Instagram
// might just be pausing pagination; the caller can't tell which from this
// alone (see scrollDirectionToCompletion, which retries when it can check
// against the platform's own stated total).
type ScrollOutcome = 'reached-target' | 'gave-up'

let autoScrollPromise: Promise<ScrollOutcome> | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// querySelector's "first match" isn't safe: Instagram doesn't always remove
// a closed dialog's element from the DOM (mid CSS transition, or just left
// mounted), so the first followers/following dialog ever opened can
// permanently win every lookup afterwards — freezing auto-scroll onto that
// stale, hidden dialog's (unchanging) container while the real, visible one
// never gets scrolled. Walk from the end (newest-mounted first) and take the
// first one that's actually on screen.
function getVisibleDialog(): HTMLElement | null {
  const dialogs = [...document.querySelectorAll<HTMLElement>('div[role="dialog"]')]
  for (let i = dialogs.length - 1; i >= 0; i--) {
    const el = dialogs[i]
    if (el.getAttribute('aria-hidden') === 'true') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    return el
  }
  return dialogs[0] ?? null
}

// minDelta gates out unrelated overflow:auto elements elsewhere on the page
// (sidebars, tooltips) when scanning the whole document. Inside a modal
// dialog there's only ever one real scroll target — the list — and on first
// open it can legitimately have zero or near-zero overflow (few rows loaded
// yet, nothing to scroll *to* until we start), so it must still be picked up
// or nothing ever kicks off the platform's own lazy-loading.
function findScrollableContainer(scope: ParentNode, minDelta = 40): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestDelta = minDelta - 1

  scope.querySelectorAll<HTMLElement>('div, section, ul, main').forEach((el) => {
    const overflowY = getComputedStyle(el).overflowY
    if (overflowY !== 'auto' && overflowY !== 'scroll') return
    // A container with no visible viewport at all (clientHeight 0) isn't the
    // list about to load — it's an unrelated panel the platform keeps
    // mounted-but-unopened (seen on TikTok: a hidden inbox/messages dialog
    // with overflow:auto CSS but 0 height). Without this check, minDelta's
    // 0-inside-a-dialog allowance (see comment above) lets a container like
    // that win by default even though there's nothing on screen to scroll —
    // autoScroll then spins on it forever while the real list, if one is
    // even open, never gets touched.
    if (el.clientHeight === 0) return
    const delta = el.scrollHeight - el.clientHeight
    if (delta < minDelta) return
    if (delta > bestDelta) {
      bestDelta = delta
      best = el
    }
  })

  return best
}

// `shouldStop` is checked ahead of the platform's own stated total (e.g.
// Instagram's "131 takipçi" header stat), when the caller has one — it's a
// precise, tamper-proof-ish signal that plain height-stagnation isn't:
// Instagram appends a "suggested accounts" strip to the *same* scrollable
// list once the real one is exhausted, which keeps scrollHeight growing and
// makes stagnation alone think the real list is still loading.
function autoScroll(shouldStop?: () => boolean): Promise<ScrollOutcome> {
  if (autoScrollPromise) return autoScrollPromise
  const promise = runAutoScroll(shouldStop).finally(() => {
    autoScrollPromise = null
  })
  autoScrollPromise = promise
  return promise
}

async function runAutoScroll(shouldStop?: () => boolean): Promise<ScrollOutcome> {

  const MAX_ITERATIONS = 600
  // Height staying flat no longer needs to mean "wait it out and hope" — for
  // Instagram, shouldStop (below) already checks the platform's own hasMore
  // signal on every iteration, so a real mid-fetch pause is caught
  // immediately rather than by outlasting this timeout. Giving up on
  // stagnation quickly here just hands the decision to
  // scrollDirectionToCompletion's hasMore-aware retry (reopen the dialog)
  // instead of burning ~30-40s of dead waiting inside a single pass first.
  const MAX_STAGNANT_ROUNDS = 4
  let stagnantRounds = 0
  let lastHeight = -1

  for (let i = 0; i < MAX_ITERATIONS && collecting; i++) {
      if (shouldStop?.()) {
        debugLog('autoScroll: expected count reached, stopping', { iteration: i })
        return 'reached-target'
      }

      // When a modal list is open (Instagram), scroll inside it rather
      // than the page behind it — otherwise we'd scroll the feed and never
      // load more of the actual list.
      const dialog = getVisibleDialog()
      const container = findScrollableContainer(dialog ?? document, dialog ? 0 : 40)
      let height: number

      // One viewport at a time, not a jump straight to scrollHeight. A
      // virtualized list (confirmed live: Instagram's followers/following
      // modal) only renders — and only fires its own "load more"
      // IntersectionObserver sentinel — near whatever's currently in the
      // viewport. Setting scrollTop to the full scrollHeight in one step can
      // land past that sentinel's position entirely (scrollHeight reflects
      // the platform's own estimate of the full list, which is taller than
      // what's actually been fetched so far), so it never fires and no more
      // rows ever load — seen live as scrollHeight going permanently flat
      // well short of the account's real follower count, no matter how long
      // the loop waits afterward.
      if (container) {
        container.scrollTop = Math.min(container.scrollTop + container.clientHeight, container.scrollHeight)
        height = container.scrollHeight
      } else {
        window.scrollTo({ top: Math.min(window.scrollY + window.innerHeight, document.documentElement.scrollHeight) })
        height = document.documentElement.scrollHeight
      }

      if (i < 3 || i % 10 === 0) {
        debugLog('autoScroll', {
          iteration: i,
          dialog: !!dialog,
          container: container ? `${container.tagName}.${container.className}`.slice(0, 120) : null,
          scrollHeight: container?.scrollHeight ?? document.documentElement.scrollHeight,
          clientHeight: container?.clientHeight ?? document.documentElement.clientHeight,
          height,
          lastHeight,
          stagnantRounds,
        })
      }

      // Human-ish pacing — also gives the platform's own lazy-load time to
      // fire. Grows with consecutive stagnant rounds so a slow fetch gets
      // more room to finish before the next height check.
      await sleep(550 + Math.random() * 450 + stagnantRounds * 600)

      if (height === lastHeight) {
        stagnantRounds += 1
        if (stagnantRounds >= MAX_STAGNANT_ROUNDS) {
          debugLog('autoScroll: giving up, height stagnant', { iteration: i, height })
          return 'gave-up'
        }
      } else {
        stagnantRounds = 0
        lastHeight = height
      }
  }
  return 'gave-up'
}

// Any adapter for this hostname regardless of mode — used to drive
// navigation (openList) for a json-mode adapter too, which getDomAdapterForHost
// below deliberately excludes (they have no DOM list to parse).
const pageAdapter = getAdapterForHost(window.location.hostname)

// --- DOM-mode platforms (GitHub, Instagram): the list is read straight off
// the rendered page rather than by intercepting a JSON response.
const domAdapter = getDomAdapterForHost(window.location.hostname)
domAdapter?.init?.()

// Set up once a DOM adapter is present; called when collection starts.
let reportOpenList: (() => void) | null = null

if (domAdapter?.detectListPage && domAdapter.parseDom) {
  const adapter = domAdapter
  // Dedup is keyed by direction, not bare username — the same person can be
  // both a follower and someone you follow, and must be reported for each
  // list rather than dropped from whichever one is scanned second. Tracking
  // usernames (not a row count) also survives Instagram's virtualized list,
  // whose visible rows change while their count stays constant.
  const reported = new Set<string>()
  clearReportedDedup = () => reported.clear()
  const reportedCountFor = (direction: FriendshipDirection): number => {
    let count = 0
    for (const key of reported) if (key.startsWith(`${direction}:`)) count += 1
    return count
  }
  // Checked on every autoScroll iteration — hasMore (read live, not
  // captured once) is Instagram's own confirmation that pagination is
  // exhausted, so it stops the loop immediately on the very next check
  // rather than waiting out MAX_STAGNANT_ROUNDS of height-stagnation first.
  // expectedCount is the fallback for when no network signal has arrived.
  const scrollStopPredicate = (direction: FriendshipDirection): (() => boolean) => {
    const expected = adapter.expectedCount?.(direction)
    return () => {
      if (lastHasMoreByDirection.get(direction) === false) return true
      return expected != null && reportedCountFor(direction) >= expected
    }
  }
  let navigating = false
  let observer: MutationObserver | null = null

  // GitHub's followers/following lists are server-paginated, not infinite
  // scroll, so this follows the list's own next-page link until there isn't
  // one left. Which link that is — and why the choice is subtler than it
  // looks — lives in ./next-page.ts. Only runs while collecting.
  const goToNextPage = () => {
    if (navigating || !collecting) return

    const next = findNextPageLink(document, location.href, readVisitedPages())
    if (!next) return

    const target = next.href
    navigating = true
    // Recorded before leaving, so the page being left can never be walked
    // back into from further along the list.
    markVisitedPage(location.href)
    observer?.disconnect()
    setTimeout(() => {
      // Re-check: the user may have hit "stop" during this delay — without
      // this, GitHub keeps navigating to the next followers/following page
      // after collection was already turned off.
      if (collecting) window.location.href = target
    }, 500 + Math.random() * 400)
  }

  // Reports whatever list is currently open. Guided adapters may try to open
  // or switch the list themselves; once one is detectable here, this reports
  // it and, for an infinite-scroll list, keeps scrolling to load the rest.
  const report = async (): Promise<number> => {
    const page = adapter.detectListPage!(window.location)
    if (!page) return 0

    const users = adapter.parseDom!(document, page)
    // Instagram appends a "suggested accounts" strip to the SAME scrollable
    // dialog once the real list is exhausted (see the autoScroll comment
    // above on scrollHeight growth) — confirmed live, it inflated a
    // 139-follower account's scrape to 162 once the observer kept re-reading
    // the dialog after the real list had already ended. The profile's own
    // stated total can never legitimately be exceeded, so once it's reached,
    // any row not already known is dropped rather than trusted; already-known
    // rows are still resent below (harmless — keeps avatar/displayName
    // fresh, and lets `fresh.length` still trigger a report when nothing new
    // fits in the remaining room).
    const expected = adapter.expectedCount?.(page.direction) ?? null
    let room = expected != null ? expected - reportedCountFor(page.direction) : Infinity
    // Lowercased so a re-render of the same account under different casing
    // (mirrors the same normalization in addBufferUsers) doesn't read as a
    // second, "new" user and get resent/recounted.
    const accepted = users.filter((u) => {
      const key = `${page.direction}:${u.username.toLowerCase()}`
      if (reported.has(key)) return true
      if (room <= 0) return false
      room -= 1
      return true
    })
    const fresh = accepted.filter((u) => !reported.has(`${page.direction}:${u.username.toLowerCase()}`))
    // Only report while a scan is actually running — this MutationObserver
    // callback fires on any DOM change regardless of collecting state, so
    // without this gate merely opening/glancing at a followers dialog
    // (never clicking Start) would silently add that account to the picker.
    // Not marking `fresh` as reported here either: if the user starts a scan
    // afterward on this same still-open dialog, those rows must be resent
    // then, not treated as already-seen from before Start was pressed.
    if (fresh.length > 0 && collecting) {
      fresh.forEach((u) => reported.add(`${page.direction}:${u.username.toLowerCase()}`))
      await reportUsers(adapter.id, page.direction, page.accountId, page.accountUsername, accepted, expected)
      // Guarded rather than passed straight to debugLog: the username list
      // below copies, filters and maps the whole dedup set, which on a large
      // account is thousands of strings rebuilt on every report — work that
      // was happening for every user with the flag off and nothing printed.
      if (isDebugLoggingEnabled()) {
        debugLog(
          `report: ${page.direction} now has`,
          reportedCountFor(page.direction),
          'unique users:',
          [...reported].filter((key) => key.startsWith(`${page.direction}:`)).map((key) => key.slice(page.direction.length + 1)),
        )
      }
    }

    if (collecting) {
      if (adapter.scrollBehavior === 'paginated') goToNextPage()
      else if (adapter.scrollBehavior === 'infinite') autoScroll(scrollStopPredicate(page.direction))
    }

    return users.length
  }

  // One forward scroll pass can genuinely miss rows, and re-sweeping the
  // *same* open dialog doesn't recover them — confirmed live across several
  // runs: each automated pass lands on a different-sized, non-overlapping
  // subset of the real list (e.g. one run had 'silaozdemir47'/'hs.uzun' but
  // not 'bozkurttmervee'/'ali.tugra_'; the next run was the reverse), and
  // re-scrolling within one already-open dialog kept landing on
  // similarly-incomplete subsets rather than converging. What did work,
  // confirmed manually: closing and *reopening* the dialog 3-4 times, each
  // pass catching a different subset, union-ed together since the dedup
  // buffer persists across opens. Whatever Instagram randomizes/re-seeds
  // between passes, it seems tied to a fresh open, not to how much of the
  // currently-open one gets scrolled.
  const reopenDirectionList = async (direction: FriendshipDirection): Promise<boolean> => {
    adapter.closeList?.()
    for (let i = 0; i < 10 && collecting; i++) {
      await sleep(400)
      if (!getVisibleDialog()) break
    }
    if (!collecting) return false
    if (!adapter.openList?.(direction)) return false
    // openList's own internal retries can take a couple of seconds to land
    // a click — give the freshly-opened dialog time to actually render
    // before the next scroll pass starts probing it.
    await sleep(2000 + Math.random() * 500)
    return collecting
  }

  // The profile header's own stated total (adapter.expectedCount) is the
  // real goal here — the user can see that number, and expects the scan to
  // actually reach it. hasMore stays scoped to scrollStopPredicate: it just
  // ends a single stagnant pass quickly instead of waiting out
  // MAX_STAGNANT_ROUNDS, so the next reopen attempt starts sooner. It does
  // NOT gate whether to keep trying — "this session's pagination says
  // false" isn't "the account truly has no more to find", confirmed live:
  // reopening past a hasMore:false / stagnant pass is exactly what reached
  // the real total when a single session's pagination fell short of it.
  const isDirectionIncomplete = (direction: FriendshipDirection): boolean => {
    const expected = adapter.expectedCount?.(direction)
    return expected != null && reportedCountFor(direction) < expected
  }

  const scrollDirectionToCompletion = async (direction: FriendshipDirection): Promise<void> => {
    await autoScroll(scrollStopPredicate(direction))
    await report()

    // Bounded higher than a single stall would need, because reopens keep
    // paying off for a while (confirmed live: followers converged on attempt
    // 3-4). The stall check below is what actually caps the cost — two
    // reopens in a row with zero net new users means the gap to the header
    // stat isn't reachable this way (Instagram's own header count can include
    // accounts the friendship API never returns, e.g. restricted/deactivated
    // ones), so retrying further would just spin without ever converging.
    const MAX_REOPENS = 6
    let stallStreak = 0
    let previousCount = reportedCountFor(direction)
    for (let attempt = 0; attempt < MAX_REOPENS && collecting && isDirectionIncomplete(direction); attempt++) {
      debugLog('scrollDirectionToCompletion: still below the profile\'s stated total, closing and reopening the list for another pass', {
        direction,
        collected: reportedCountFor(direction),
        expected: adapter.expectedCount?.(direction) ?? null,
        attempt,
      })
      if (!(await reopenDirectionList(direction))) return
      await autoScroll(scrollStopPredicate(direction))
      await report()

      const currentCount = reportedCountFor(direction)
      if (currentCount <= previousCount) {
        stallStreak += 1
        if (stallStreak >= 2) {
          debugLog('scrollDirectionToCompletion: two reopens in a row found no new users — likely a real ceiling below the profile\'s stated total (e.g. accounts the API never returns), stopping', {
            direction,
            collected: currentCount,
            expected: adapter.expectedCount?.(direction) ?? null,
          })
          return
        }
      } else {
        stallStreak = 0
      }
      previousCount = currentCount
    }

    if (collecting && isDirectionIncomplete(direction)) {
      debugLog('scrollDirectionToCompletion: giving up after reopening several times, still below the profile\'s stated total', {
        direction,
        collected: reportedCountFor(direction),
        expected: adapter.expectedCount?.(direction) ?? null,
      })
    }
  }

  const startObserving = () => {
    observer = new MutationObserver(() => report())
    observer.observe(document.body, { childList: true, subtree: true })
    report()
  }
  if (document.body) startObserving()
  else document.addEventListener('DOMContentLoaded', startObserving, { once: true })

  if (adapter.openList) {
    const requestGuidedOpen = (direction: FriendshipDirection): boolean => {
      if (hasGuidedOpenedDirection(direction)) return true
      const opened = adapter.openList!(direction)
      if (opened) markGuidedOpenedDirection(direction)
      return opened
    }

    // Guided followers→following sequence. Instagram builds differ: some
    // honor the stat click, others only work after falling back to the list
    // route. Progress is checkpointed in sessionStorage so either path can
    // resume cleanly after a direction switch.
    reportOpenList = () => {
      if (guidedFlowActive) return
      guidedFlowActive = true
      // Runs at document_start, before Instagram's own JS has rendered
      // anything — acting immediately would scroll/inspect a blank page and
      // mistake "hasn't loaded yet" for "list exhausted". Give the SPA a
      // real chance to render first.
      const proceed = async () => {
        if (!collecting) {
          guidedFlowActive = false
          return
        }
        const page = adapter.detectListPage!(window.location)
        const expectedDirection = readGuidedDirection()

        if (page && expectedDirection && page.direction !== expectedDirection) {
          const attempts = readGuidedOpenAttempts()
          if (attempts >= 8) {
            writeGuidedDirection(null)
            guidedFlowActive = false
            setCollecting(false)
            return
          }
          writeGuidedOpenAttempts(attempts + 1)
          if (!hasGuidedOpenedDirection(expectedDirection)) requestGuidedOpen(expectedDirection)
          setTimeout(proceed, 2000)
          return
        }

        if (page) {
          // Either the user opened this list manually or the guided flow did;
          // either way, it's genuinely open right now.
          writeGuidedDirection(page.direction)
          writeGuidedOpenAttempts(0)
          let visibleRows = await report()
          for (let attempt = 0; collecting && visibleRows === 0 && attempt < 16; attempt++) {
            await sleep(500)
            visibleRows = await report()
          }
          if (collecting && visibleRows === 0) {
            setTimeout(proceed, 1500)
            return
          }
          if (!collecting) return
          if (adapter.scrollBehavior === 'infinite') {
            await scrollDirectionToCompletion(page.direction)
          } else if (adapter.scrollBehavior === 'paginated') {
            await report()
            if (navigating) {
              // report() found a next page and already scheduled the
              // navigation to it (see goToNextPage) — that reload re-runs
              // this whole guided flow from scratch (readPersistedCollecting
              // at the bottom of this file), and readGuidedDirection() will
              // still say this same direction, so it resumes exactly where
              // this page left off instead of switching early.
              guidedFlowActive = false
              return
            }
          } else {
            await report()
          }
          if (!collecting) return

          if (page.direction === 'followers') {
            writeGuidedDirection('following')
            if (requestGuidedOpen('following')) setTimeout(proceed, 1500)
            else setCollecting(false)
          } else {
            writeGuidedDirection(null)
            guidedComplete = true
            guidedFlowActive = false
            setCollecting(false)
            // Both directions are in the buffer — leaving the dialog open
            // just strands the user looking at a finished scan they still
            // have to manually dismiss.
            adapter.closeList?.()
          }
          return
        }

        if (readGuidedDirection()) {
          // We asked for a list and it still isn't detectable. Do not call
          // openList() again here: it already retries its own click a couple
          // of times internally, and calling it again from out here on top
          // of that risks re-triggering the close-then-reopen dance mid-way
          // through its own attempt.
          const attempts = readGuidedOpenAttempts()
          if (attempts >= 8) {
            writeGuidedDirection(null)
            guidedFlowActive = false
            setCollecting(false)
            return
          }
          writeGuidedOpenAttempts(attempts + 1)
          setTimeout(proceed, 2000)
          return
        }

        // Fresh start: nothing open yet, no sequence in progress.
        writeGuidedDirection('followers')
        if (!requestGuidedOpen('followers')) {
          writeGuidedDirection(null)
          guidedFlowActive = false
          setCollecting(false)
        } else {
          setTimeout(proceed, 1500)
        }
      }

      if (document.readyState === 'complete') setTimeout(proceed, 1200)
      else window.addEventListener('load', () => setTimeout(proceed, 1200), { once: true })
    }
  } else {
    reportOpenList = report
  }
}

// `reportOpenList` is set for every adapter that can read a list off the page,
// which is both current ones — so the fallback is only reached on a host that
// matched the manifest but whose adapter parses nothing, and all it can
// usefully do is scroll and let passive interception pick up what loads.
function startDomFlow(): void {
  if (reportOpenList) reportOpenList()
  else autoScroll()
}

// Set (via startSelfFetchCooldown, called on any SELF_FETCH_FAILED) after a
// platform rejects a self-fetch pass — chrome.storage.local since a soft
// rejection is about the account/session, not this one tab, and needs to
// survive across separate scans. Repeating the exact same request pattern
// again immediately, on every subsequent scan, is how a temporary edge-level
// slowdown turns into a longer one; skipping straight to the DOM path for a
// while instead gives it room to clear on its own.
// Keyed per platform — self-fetch now spans more than one adapter (Instagram,
// GitHub), each hitting a completely different domain with a completely
// different risk profile. A single shared key meant a rejection on one
// platform silently suppressed self-fetch on every other platform's tabs too.
// The prefix itself lives in shared/settings.ts so the Settings page's
// "delete everything" can enumerate and clear these too.
const SELF_FETCH_COOLDOWN_MS = 3 * 60 * 60 * 1000

async function isSelfFetchCoolingDown(platform: PlatformId): Promise<boolean> {
  const key = SELF_FETCH_COOLDOWN_KEY_PREFIX + platform
  try {
    const stored = await chrome.storage.local.get(key)
    const until = stored[key]
    return typeof until === 'number' && Date.now() < until
  } catch {
    return false
  }
}

function startSelfFetchCooldown(platform: PlatformId): void {
  try {
    // The try/catch around this only catches a synchronous throw — the write
    // itself rejects asynchronously on an invalidated context, which needs its
    // own handler or it becomes an unhandled rejection on the page.
    void chrome.storage.local
      .set({ [SELF_FETCH_COOLDOWN_KEY_PREFIX + platform]: Date.now() + SELF_FETCH_COOLDOWN_MS })
      .catch(() => undefined)
  } catch {
    // Storage can be unavailable in edge cases — the cooldown just won't
    // persist this once, not fatal (self-fetch is still safe to retry, just
    // without the extra caution this would have added).
  }
}

async function tryStartSelfFetch(username: string): Promise<void> {
  if (!pageAdapter?.selfFetch) return
  // The user can switch active fetching off entirely in Settings, leaving only
  // passive collection (what their own scrolling already requests) — see
  // shared/settings.ts for why this is a switch rather than fixed behavior.
  if (!(await isSelfFetchAllowed())) {
    debugLog('self-fetch: disabled in settings, using the passive DOM flow instead')
    startDomFlow()
    return
  }
  if (await isSelfFetchCoolingDown(pageAdapter.id)) {
    debugLog('self-fetch: still cooling down after a recent rejection, going straight to the DOM flow')
    startDomFlow()
    return
  }
  window.postMessage({ source: 'followlens', type: 'START_SELF_FETCH', platform: pageAdapter.id, username }, window.location.origin)
  clearSelfFetchWatchdog()
  selfFetchWatchdog = setTimeout(() => {
    if (collecting) fallBackFromSelfFetch('produced no response within 5s (message may have been dropped, or the page was not ready yet)')
  }, 5000)
}

/** Gives collection an immediate push when the user switches it on — reports whatever list (if any) is already open, and kicks off scrolling where there is no list parser to drive instead. */
function kickCollection(): void {
  if (pageAdapter?.selfFetch) {
    const username = guessAccountLabel()
    if (username) {
      void tryStartSelfFetch(username)
      return
    }
    // No canonical link to read a username from (unusual page state) — the
    // DOM flow below can still work off the URL directly, so fall through
    // to it rather than stalling the scan.
    debugLog('kickCollection: self-fetch available but no account username found, falling back to the DOM flow')
  }
  startDomFlow()
}

// Resume after a same-tab navigation while collecting (GitHub pagination):
// the flag survives in sessionStorage, so pick up where the last page left off.
if (readPersistedCollecting()) {
  setCollecting(true)
}
