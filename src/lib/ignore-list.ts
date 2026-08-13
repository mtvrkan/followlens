import { accountKey } from './account-key'
import type { PlatformId } from './types'

const STORAGE_KEY = 'ignoredUsers'

type IgnoredUsersStore = Record<string, string[]>

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

function normalizeList(usernames: string[]): string[] {
  return [...new Set(usernames.map(normalizeUsername).filter(Boolean))].sort()
}

function isStore(value: unknown): value is IgnoredUsersStore {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function isIgnoredUsername(username: string, ignoredUsernames: ReadonlySet<string>): boolean {
  return ignoredUsernames.has(normalizeUsername(username))
}

export async function getIgnoredUsernames(
  platform: PlatformId,
  accountId: string,
  storage: Pick<typeof chrome.storage.local, 'get'> = chrome.storage.local,
): Promise<string[]> {
  const { [STORAGE_KEY]: raw } = await storage.get(STORAGE_KEY)
  if (!isStore(raw)) return []
  const list = raw[accountKey(platform, accountId)]
  return Array.isArray(list) ? normalizeList(list.filter((value): value is string => typeof value === 'string')) : []
}

export async function setIgnoredUsernames(
  platform: PlatformId,
  accountId: string,
  usernames: string[],
  storage: Pick<typeof chrome.storage.local, 'get' | 'set'> = chrome.storage.local,
): Promise<string[]> {
  const { [STORAGE_KEY]: raw } = await storage.get(STORAGE_KEY)
  const nextStore: IgnoredUsersStore = { ...(isStore(raw) ? raw : {}) }
  const nextList = normalizeList(usernames)
  const key = accountKey(platform, accountId)
  if (nextList.length > 0) {
    nextStore[key] = nextList
  } else {
    delete nextStore[key]
  }
  await storage.set({ [STORAGE_KEY]: nextStore })
  return nextList
}

/**
 * Drops one account's whole ignore list — part of forgetting that account,
 * alongside its snapshots, buffer, label and badge contribution. Without this,
 * re-scanning the same account later silently resurrected an old ignore list
 * the user had no way to see or clear, quietly hiding rows from "not following
 * back".
 */
export async function deleteIgnoredUsernames(
  platform: PlatformId,
  accountId: string,
  storage: Pick<typeof chrome.storage.local, 'get' | 'set'> = chrome.storage.local,
): Promise<void> {
  const { [STORAGE_KEY]: raw } = await storage.get(STORAGE_KEY)
  if (!isStore(raw)) return
  const key = accountKey(platform, accountId)
  if (!(key in raw)) return
  const nextStore: IgnoredUsersStore = { ...raw }
  delete nextStore[key]
  await storage.set({ [STORAGE_KEY]: nextStore })
}

export async function toggleIgnoredUsername(
  platform: PlatformId,
  accountId: string,
  username: string,
  storage: Pick<typeof chrome.storage.local, 'get' | 'set'> = chrome.storage.local,
): Promise<{ ignored: boolean; usernames: string[] }> {
  const current = await getIgnoredUsernames(platform, accountId, storage)
  const normalized = normalizeUsername(username)
  const next = current.includes(normalized) ? current.filter((item) => item !== normalized) : [...current, normalized]
  const usernames = await setIgnoredUsernames(platform, accountId, next, storage)
  return { ignored: usernames.includes(normalized), usernames }
}
