import { describe, expect, it } from 'vitest'
import { isSelfFetchAllowed, listSelfFetchCooldownKeys, SELF_FETCH_COOLDOWN_KEY_PREFIX, SELF_FETCH_KEY } from './settings'

function storage(value: unknown): Pick<typeof chrome.storage.local, 'get'> {
  return { get: () => Promise.resolve({ [SELF_FETCH_KEY]: value }) } as Pick<typeof chrome.storage.local, 'get'>
}

describe('isSelfFetchAllowed', () => {
  // Absent means "the user never chose", which must resolve to the documented
  // default rather than reading as a deliberate opt-out.
  it('defaults to allowed when nothing has been stored', async () => {
    await expect(isSelfFetchAllowed(storage(undefined))).resolves.toBe(true)
  })

  it('is allowed when explicitly enabled', async () => {
    await expect(isSelfFetchAllowed(storage(true))).resolves.toBe(true)
  })

  it('is refused only when explicitly disabled', async () => {
    await expect(isSelfFetchAllowed(storage(false))).resolves.toBe(false)
  })

  it('falls back to the default rather than changing behavior when storage throws', async () => {
    const broken = {
      get: () => Promise.reject(new Error('storage unavailable')),
    } as Pick<typeof chrome.storage.local, 'get'>

    await expect(isSelfFetchAllowed(broken)).resolves.toBe(true)
  })
})

// These keys are what "delete everything" in Settings has to be able to find:
// they are written per platform by the content script, so a wipe cannot list
// them by name — it has to discover them by prefix.
describe('listSelfFetchCooldownKeys', () => {
  const allKeys = (stored: Record<string, unknown>) =>
    ({ get: () => Promise.resolve(stored) }) as Pick<typeof chrome.storage.local, 'get'>

  it('finds every per-platform cooldown key and nothing else', async () => {
    const stored = {
      [`${SELF_FETCH_COOLDOWN_KEY_PREFIX}instagram`]: 123,
      [`${SELF_FETCH_COOLDOWN_KEY_PREFIX}github`]: 456,
      [SELF_FETCH_KEY]: true,
      accountLabels: {},
    }

    await expect(listSelfFetchCooldownKeys(allKeys(stored))).resolves.toEqual([
      `${SELF_FETCH_COOLDOWN_KEY_PREFIX}instagram`,
      `${SELF_FETCH_COOLDOWN_KEY_PREFIX}github`,
    ])
  })

  it('returns nothing when no cooldown was ever recorded', async () => {
    await expect(listSelfFetchCooldownKeys(allKeys({ [SELF_FETCH_KEY]: false }))).resolves.toEqual([])
  })

  // A wipe must still delete everything else it can rather than aborting on
  // this one lookup.
  it('returns nothing rather than throwing when storage is unreachable', async () => {
    const broken = { get: () => Promise.reject(new Error('storage unavailable')) } as Pick<typeof chrome.storage.local, 'get'>
    await expect(listSelfFetchCooldownKeys(broken)).resolves.toEqual([])
  })
})
