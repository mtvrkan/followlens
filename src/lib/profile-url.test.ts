import { describe, expect, it } from 'vitest'
import { profileUrl } from './profile-url'

describe('profileUrl', () => {
  it('builds a GitHub profile URL', () => {
    expect(profileUrl('github', 'octocat')).toBe('https://github.com/octocat')
  })

  it('builds an Instagram profile URL', () => {
    expect(profileUrl('instagram', 'someone')).toBe('https://www.instagram.com/someone/')
  })

  it('falls back to Instagram-shaped URL when platform is null', () => {
    expect(profileUrl(null, 'someone')).toBe('https://www.instagram.com/someone/')
  })

  // Usernames originate from page-supplied data; path separators in one must not
  // be able to steer the link somewhere else.
  it('encodes path separators instead of letting them redirect the link', () => {
    expect(profileUrl('github', '../login')).toBe('https://github.com/..%2Flogin')
    expect(profileUrl('instagram', 'a/b?c#d')).toBe('https://www.instagram.com/a%2Fb%3Fc%23d/')
  })
})
