import { adaptersById } from '../platforms/registry'
import type { FriendshipDirection, PlatformId, SocialUser } from '../platforms/types'
import type { SaveSnapshotResult } from '../lib/types'
import { isResult, type Result } from './result'

/**
 * The single typed protocol for every message that crosses a context
 * boundary. Three boundaries exist:
 *
 *  1. MAIN world → content script (`window.postMessage`): WindowMessage
 *  2. content script / popup / dashboard → background: RuntimeMessage
 *  3. background → sender: Result<ResponseFor<message>>
 *
 * All senders go through the helpers below; all receivers validate with the
 * guards below before touching a field. Payloads from the page (follower
 * lists parsed out of page-controlled JSON/DOM) additionally pass through
 * `sanitizeUsers` at the background boundary.
 */

// --- Boundary 2: runtime messages -----------------------------------------

export interface FriendshipPageMessage {
  type: 'FRIENDSHIP_PAGE'
  platform: PlatformId
  accountId: string
  accountUsername?: string | null
  direction: FriendshipDirection
  users: SocialUser[]
  /** The adapter's live read of the platform's own stated total for this direction, when it has one (see `PlatformAdapter.expectedCount`). */
  expectedCount?: number | null
}

export interface SaveSnapshotMessage {
  type: 'SAVE_SNAPSHOT'
  platform: PlatformId
  accountId: string
  force: boolean
}

export interface DeleteAccountMessage {
  type: 'DELETE_ACCOUNT'
  platform: PlatformId
  accountId: string
}

/** Deletes one saved snapshot (a single point-in-time scan) rather than the whole account's history. */
export interface DeleteSnapshotMessage {
  type: 'DELETE_SNAPSHOT'
  platform: PlatformId
  accountId: string
  snapshotId: number
}

export interface GetBufferStatusMessage {
  type: 'GET_BUFFER_STATUS'
  platform: PlatformId
  accountId: string
}

/**
 * Discards the in-progress (not yet saved) scan for one account — the escape
 * hatch for when a scan collected wrong/mislabeled data, without touching
 * previously saved snapshot history.
 */
export interface ResetBufferMessage {
  type: 'RESET_BUFFER'
  platform: PlatformId
  accountId: string
}

export type RuntimeMessage =
  | FriendshipPageMessage
  | SaveSnapshotMessage
  | DeleteAccountMessage
  | DeleteSnapshotMessage
  | GetBufferStatusMessage
  | ResetBufferMessage

export interface BufferStatus {
  followers: number
  following: number
  /** The platform's own live-read stated total per direction (see `FriendshipPageMessage.expectedCount`), when one has been seen this scan. */
  expectedFollowers?: number | null
  expectedFollowing?: number | null
}

/** Maps each message type to what the background returns inside `Result.value`. */
export interface ResponseByType {
  FRIENDSHIP_PAGE: BufferStatus
  SAVE_SNAPSHOT: SaveSnapshotResult
  DELETE_ACCOUNT: null
  DELETE_SNAPSHOT: null
  GET_BUFFER_STATUS: BufferStatus
  RESET_BUFFER: null
}

export type ResponseFor<M extends RuntimeMessage> = ResponseByType[M['type']]

// --- Popup → content script (per-tab) ---------------------------------------

/**
 * Auto-collection (scrolling / pagination) never starts on its own: it is
 * switched on per tab by an explicit user gesture in the popup, and can be
 * stopped from either the popup or the on-page indicator.
 */
export interface ScanControlMessage {
  type: 'SCAN_CONTROL'
  action: 'start' | 'stop'
}

export interface GetScanStateMessage {
  type: 'GET_SCAN_STATE'
}

/**
 * Clears the content script's own "already reported this user" memory for
 * the current page. Sent together with RESET_BUFFER (which clears the
 * background's copy) — without this half, restarting collection after a
 * reset would silently re-suppress everyone already seen once and never
 * re-send them.
 */
export interface ResetCollectedMessage {
  type: 'RESET_COLLECTED'
}

export type TabMessage = ScanControlMessage | GetScanStateMessage | ResetCollectedMessage

export interface ScanState {
  collecting: boolean
  /**
   * Progress of the guided followers→following sequence (Instagram-style
   * adapters with `openList`): `false` while it's still running or hasn't
   * started, `true` once both directions have been opened and scrolled to
   * their end. `null` for adapters with no such sequence (GitHub, manual
   * scroll, json-mode platforms) — the popup falls back to its own
   * stall-based heuristic for those.
   */
  guidedComplete: boolean | null
}

/** Maps each tab-message type to what the content script returns inside `Result.value`. */
export interface TabResponseByType {
  SCAN_CONTROL: ScanState
  GET_SCAN_STATE: ScanState
  RESET_COLLECTED: null
}

export type TabResponseFor<M extends TabMessage> = TabResponseByType[M['type']]

export function isScanControlMessage(message: unknown): message is ScanControlMessage {
  if (!message || typeof message !== 'object') return false
  const m = message as Record<string, unknown>
  return m.type === 'SCAN_CONTROL' && (m.action === 'start' || m.action === 'stop')
}

export function isGetScanStateMessage(message: unknown): message is GetScanStateMessage {
  return !!message && typeof message === 'object' && (message as Record<string, unknown>).type === 'GET_SCAN_STATE'
}

export function isResetCollectedMessage(message: unknown): message is ResetCollectedMessage {
  return !!message && typeof message === 'object' && (message as Record<string, unknown>).type === 'RESET_COLLECTED'
}

/** Typed, never-throwing wrapper around chrome.tabs.sendMessage (content script may not be injected). */
export async function sendTabMessage<M extends TabMessage>(tabId: number, message: M): Promise<Result<TabResponseFor<M>>> {
  try {
    const response: unknown = await chrome.tabs.sendMessage(tabId, message)
    if (isResult(response)) return response as Result<TabResponseFor<M>>
    return { ok: false, error: 'malformed-response' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send-failed' }
  }
}

// --- Boundary 1: MAIN world → content script -------------------------------

export interface WindowMessage {
  source: 'followlens'
  type: 'FRIENDSHIP_PAGE'
  platform: PlatformId
  direction: FriendshipDirection
  accountId: string
  users: SocialUser[]
  /** The platform's own "is there more to fetch" signal for this response, when it has one (e.g. Instagram's `has_more`) — see `PlatformAdapter.parseHasMore`. */
  hasMore?: boolean | null
  /** The platform's own exact total for this direction, when the response body states it — see `PlatformAdapter.parseTotal`. */
  total?: number | null
}

// --- Guards & sanitizers ----------------------------------------------------

export function isPlatformId(value: unknown): value is PlatformId {
  return typeof value === 'string' && value in adaptersById
}

function isDirection(value: unknown): value is FriendshipDirection {
  return value === 'followers' || value === 'following'
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

const MAX_USERNAME_LENGTH = 150
const MAX_DISPLAY_NAME_LENGTH = 300
// Data-URL avatars (converted for durability by the content script) are the
// largest legitimate payload; anything bigger than this is dropped, not stored.
const MAX_AVATAR_URL_LENGTH = 200_000
// A single API response page / DOM report never legitimately carries more.
const MAX_USERS_PER_MESSAGE = 1_000

function sanitizeAvatarUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_URL_LENGTH) return ''
  if (value === '') return ''
  return value.startsWith('https://') || value.startsWith('data:image/') ? value : ''
}

/**
 * Field-level validation for user lists that ultimately originate from
 * page-controlled data (intercepted JSON, parsed DOM). Invalid entries are
 * dropped; oversized/off-scheme avatar URLs are stripped rather than trusted.
 */
export function sanitizeUsers(input: unknown): SocialUser[] {
  if (!Array.isArray(input)) return []
  const users: SocialUser[] = []

  for (const item of input.slice(0, MAX_USERS_PER_MESSAGE)) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    if (!isNonEmptyString(raw.username, MAX_USERNAME_LENGTH)) continue

    users.push({
      id: isNonEmptyString(raw.id, MAX_USERNAME_LENGTH) ? raw.id : raw.username,
      username: raw.username,
      displayName: isNonEmptyString(raw.displayName, MAX_DISPLAY_NAME_LENGTH) ? raw.displayName : raw.username,
      avatarUrl: sanitizeAvatarUrl(raw.avatarUrl),
      isVerified: raw.isVerified === true,
      isPrivate: raw.isPrivate === true,
    })
  }

  return users
}

/** Validates everything except `users` element shape — pair with `sanitizeUsers`. */
export function isFriendshipPageMessage(message: unknown): message is FriendshipPageMessage {
  if (!message || typeof message !== 'object') return false
  const m = message as Record<string, unknown>
  return (
    m.type === 'FRIENDSHIP_PAGE' &&
    isPlatformId(m.platform) &&
    isNonEmptyString(m.accountId, MAX_USERNAME_LENGTH) &&
    (m.accountUsername === undefined || m.accountUsername === null || typeof m.accountUsername === 'string') &&
    isDirection(m.direction) &&
    Array.isArray(m.users) &&
    (m.expectedCount === undefined || m.expectedCount === null || typeof m.expectedCount === 'number')
  )
}

/** Shared shape check for the platform+account command messages. */
export function isAccountCommand(
  message: unknown,
  type: 'SAVE_SNAPSHOT' | 'DELETE_ACCOUNT' | 'GET_BUFFER_STATUS' | 'RESET_BUFFER',
): message is { type: typeof type; platform: PlatformId; accountId: string } {
  if (!message || typeof message !== 'object') return false
  const m = message as Record<string, unknown>
  return m.type === type && isPlatformId(m.platform) && isNonEmptyString(m.accountId, MAX_USERNAME_LENGTH)
}

export function isDeleteSnapshotMessage(message: unknown): message is DeleteSnapshotMessage {
  if (!message || typeof message !== 'object') return false
  const m = message as Record<string, unknown>
  return (
    m.type === 'DELETE_SNAPSHOT' &&
    isPlatformId(m.platform) &&
    isNonEmptyString(m.accountId, MAX_USERNAME_LENGTH) &&
    typeof m.snapshotId === 'number' &&
    Number.isFinite(m.snapshotId)
  )
}

export function isWindowMessage(data: unknown): data is WindowMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.source === 'followlens' &&
    d.type === 'FRIENDSHIP_PAGE' &&
    isPlatformId(d.platform) &&
    isDirection(d.direction) &&
    isNonEmptyString(d.accountId, MAX_USERNAME_LENGTH) &&
    Array.isArray(d.users) &&
    (d.hasMore === undefined || d.hasMore === null || typeof d.hasMore === 'boolean') &&
    (d.total === undefined || d.total === null || typeof d.total === 'number')
  )
}

// --- Self-fetch control (content script <-> MAIN-world injected script) ---
//
// A second, deliberately separate pair of directions over the same
// window.postMessage channel as WindowMessage above:
//  - content script -> injected script: START_SELF_FETCH / STOP_SELF_FETCH
//    (commands — start/stop directly paginating the private list API for
//    one account instead of relying on DOM scroll).
//  - injected script -> content script: SELF_FETCH_COUNTS / SELF_FETCH_DONE
//    / SELF_FETCH_FAILED (results — see PlatformAdapter.selfFetch's doc for
//    why this active-fetch capability exists). Each page of users collected
//    along the way still goes out as an ordinary WindowMessage via emit(),
//    so FRIENDSHIP_PAGE handling downstream is unchanged.

export interface StartSelfFetchMessage {
  source: 'followlens'
  type: 'START_SELF_FETCH'
  platform: PlatformId
  username: string
}

export interface StopSelfFetchMessage {
  source: 'followlens'
  type: 'STOP_SELF_FETCH'
}

/**
 * Sent once, right after the profile lookup succeeds and before list
 * pagination starts — the platform's own exact follower/following totals,
 * more reliable than a scraped profile-header stat. Either count can be
 * `null` on a profile response missing that field (rare, seen on some
 * restricted/edge-case profiles) — that direction still gets self-fetched,
 * just without a target to retry against.
 */
export interface SelfFetchCountsMessage {
  source: 'followlens'
  type: 'SELF_FETCH_COUNTS'
  platform: PlatformId
  followers: number | null
  following: number | null
}

export interface SelfFetchDoneMessage {
  source: 'followlens'
  type: 'SELF_FETCH_DONE'
  platform: PlatformId
}

/** Sent when the profile lookup or a list page fetch fails (non-200, malformed response, thrown error) — the content script falls back to the DOM-scroll flow rather than the scan silently stalling. */
export interface SelfFetchFailedMessage {
  source: 'followlens'
  type: 'SELF_FETCH_FAILED'
  platform: PlatformId
}

export function isStartSelfFetchMessage(data: unknown): data is StartSelfFetchMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.source === 'followlens' && d.type === 'START_SELF_FETCH' && isPlatformId(d.platform) && isNonEmptyString(d.username, MAX_USERNAME_LENGTH)
}

export function isStopSelfFetchMessage(data: unknown): data is StopSelfFetchMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.source === 'followlens' && d.type === 'STOP_SELF_FETCH'
}

export function isSelfFetchCountsMessage(data: unknown): data is SelfFetchCountsMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    d.source === 'followlens' &&
    d.type === 'SELF_FETCH_COUNTS' &&
    isPlatformId(d.platform) &&
    (d.followers === null || typeof d.followers === 'number') &&
    (d.following === null || typeof d.following === 'number')
  )
}

export function isSelfFetchDoneMessage(data: unknown): data is SelfFetchDoneMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.source === 'followlens' && d.type === 'SELF_FETCH_DONE' && isPlatformId(d.platform)
}

export function isSelfFetchFailedMessage(data: unknown): data is SelfFetchFailedMessage {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.source === 'followlens' && d.type === 'SELF_FETCH_FAILED' && isPlatformId(d.platform)
}

// --- Senders ----------------------------------------------------------------

/**
 * Typed, never-throwing wrapper around chrome.runtime.sendMessage. Converts
 * "background not awake yet", "extension context invalidated" and handler
 * failures into a Result the caller must branch on — no silent failures.
 */
export async function sendRuntimeMessage<M extends RuntimeMessage>(message: M): Promise<Result<ResponseFor<M>>> {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message)
    if (isResult(response)) return response as Result<ResponseFor<M>>
    return { ok: false, error: 'malformed-response' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send-failed' }
  }
}
