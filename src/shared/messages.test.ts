import { describe, expect, it } from 'vitest'
import { isAccountCommand, isFriendshipPageMessage, isWindowMessage, sanitizeUsers } from './messages'

describe('sanitizeUsers', () => {
  it('keeps well-formed users as-is', () => {
    const users = sanitizeUsers([
      { id: '1', username: 'alice', displayName: 'Alice', avatarUrl: 'https://cdn.example.com/a.jpg', isVerified: true, isPrivate: true },
    ])
    expect(users).toEqual([
      { id: '1', username: 'alice', displayName: 'Alice', avatarUrl: 'https://cdn.example.com/a.jpg', isVerified: true, isPrivate: true },
    ])
  })

  it('drops entries without a usable username', () => {
    expect(sanitizeUsers([{ username: '' }, { username: 42 }, null, 'string', { displayName: 'no-username' }])).toEqual([])
  })

  it('repairs missing optional fields instead of dropping the row', () => {
    const [user] = sanitizeUsers([{ username: 'bob' }])
    expect(user).toEqual({ id: 'bob', username: 'bob', displayName: 'bob', avatarUrl: '', isVerified: false, isPrivate: false })
  })

  it('strips avatar URLs that are not https or data:image', () => {
     
    const [user] = sanitizeUsers([{ username: 'eve', avatarUrl: 'javascript:alert(1)' }])
    expect(user.avatarUrl).toBe('')
    const [ok] = sanitizeUsers([{ username: 'ok', avatarUrl: 'data:image/png;base64,AAAA' }])
    expect(ok.avatarUrl).toBe('data:image/png;base64,AAAA')
  })

  it('drops over-long usernames and truncates nothing silently', () => {
    expect(sanitizeUsers([{ username: 'x'.repeat(151) }])).toEqual([])
  })

  it('coerces isVerified to a strict boolean', () => {
    const [user] = sanitizeUsers([{ username: 'a', isVerified: 'yes' }])
    expect(user.isVerified).toBe(false)
  })

  it('coerces isPrivate to a strict boolean', () => {
    const [user] = sanitizeUsers([{ username: 'a', isPrivate: 'yes' }])
    expect(user.isPrivate).toBe(false)
  })

  it('returns [] for non-array input', () => {
    expect(sanitizeUsers({ length: 1 })).toEqual([])
    expect(sanitizeUsers(undefined)).toEqual([])
  })
})

describe('isAccountCommand', () => {
  it('accepts a valid command', () => {
    expect(isAccountCommand({ type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 'a' }, 'SAVE_SNAPSHOT')).toBe(true)
  })

  it('rejects unknown platforms and empty account ids', () => {
    expect(isAccountCommand({ type: 'SAVE_SNAPSHOT', platform: 'myspace', accountId: 'a' }, 'SAVE_SNAPSHOT')).toBe(false)
    expect(isAccountCommand({ type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: '' }, 'SAVE_SNAPSHOT')).toBe(false)
    expect(isAccountCommand({ type: 'SAVE_SNAPSHOT', platform: 'instagram', accountId: 1 }, 'SAVE_SNAPSHOT')).toBe(false)
  })

  it('rejects a mismatched type', () => {
    expect(isAccountCommand({ type: 'DELETE_ACCOUNT', platform: 'instagram', accountId: 'a' }, 'SAVE_SNAPSHOT')).toBe(false)
  })
})

describe('isFriendshipPageMessage', () => {
  const valid = {
    type: 'FRIENDSHIP_PAGE',
    platform: 'github',
    accountId: '42',
    direction: 'followers',
    users: [],
  }

  it('accepts a valid message with and without accountUsername', () => {
    expect(isFriendshipPageMessage(valid)).toBe(true)
    expect(isFriendshipPageMessage({ ...valid, accountUsername: 'alice' })).toBe(true)
    expect(isFriendshipPageMessage({ ...valid, accountUsername: null })).toBe(true)
  })

  it('rejects invalid platform, direction, or users', () => {
    expect(isFriendshipPageMessage({ ...valid, platform: 'nope' })).toBe(false)
    expect(isFriendshipPageMessage({ ...valid, direction: 'sideways' })).toBe(false)
    expect(isFriendshipPageMessage({ ...valid, users: 'not-an-array' })).toBe(false)
  })
})

describe('isWindowMessage', () => {
  it('requires the followlens source marker', () => {
    const base = { type: 'FRIENDSHIP_PAGE', platform: 'github', direction: 'followers', accountId: '1', users: [] }
    expect(isWindowMessage({ ...base, source: 'followlens' })).toBe(true)
    expect(isWindowMessage(base)).toBe(false)
    expect(isWindowMessage({ ...base, source: 'other' })).toBe(false)
  })
})
