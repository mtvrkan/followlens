import { describe, expect, it } from 'vitest'
import {
  deleteIgnoredUsernames,
  getIgnoredUsernames,
  isIgnoredUsername,
  setIgnoredUsernames,
  toggleIgnoredUsername,
} from './ignore-list'

function storageMock(initial: Record<string, unknown> = {}) {
  const store = { ...initial }
  return {
    store,
    storage: {
      get: async (key: string) => ({ [key]: store[key] }),
      set: async (values: Record<string, unknown>) => {
        Object.assign(store, values)
      },
    } as Pick<typeof chrome.storage.local, 'get' | 'set'>,
  }
}

describe('ignore list', () => {
  it('normalizes and persists ignored usernames per account', async () => {
    const { storage } = storageMock()
    const list = await setIgnoredUsernames('instagram', 'acct', [' Alice ', 'alice', 'Bob'], storage)

    expect(list).toEqual(['alice', 'bob'])
    await expect(getIgnoredUsernames('instagram', 'acct', storage)).resolves.toEqual(['alice', 'bob'])
  })

  it('toggles a username on and off', async () => {
    const { storage } = storageMock()

    await expect(toggleIgnoredUsername('github', 'octo', 'Alice', storage)).resolves.toEqual({
      ignored: true,
      usernames: ['alice'],
    })
    await expect(toggleIgnoredUsername('github', 'octo', 'alice', storage)).resolves.toEqual({
      ignored: false,
      usernames: [],
    })
  })

  it('checks ignored usernames case-insensitively', () => {
    expect(isIgnoredUsername('Alice', new Set(['alice']))).toBe(true)
  })

  it('deletes one account\'s list without touching the others', async () => {
    const { store, storage } = storageMock({
      ignoredUsers: { 'instagram:acct': ['alice'], 'github:octo': ['bob'] },
    })

    await deleteIgnoredUsernames('instagram', 'acct', storage)

    expect(store.ignoredUsers).toEqual({ 'github:octo': ['bob'] })
  })

  it('is a no-op when the account has no ignore list stored', async () => {
    const { store, storage } = storageMock({ ignoredUsers: { 'github:octo': ['bob'] } })

    await deleteIgnoredUsernames('instagram', 'acct', storage)

    expect(store.ignoredUsers).toEqual({ 'github:octo': ['bob'] })
  })

  it('is a no-op when nothing has ever been ignored', async () => {
    const { store, storage } = storageMock()

    await deleteIgnoredUsernames('instagram', 'acct', storage)

    expect(store.ignoredUsers).toBeUndefined()
  })
})
