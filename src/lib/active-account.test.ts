import { describe, expect, it } from 'vitest'
import { detectAccountFromUrl } from './active-account'

describe('detectAccountFromUrl', () => {
  it('detects Instagram profile and list pages', () => {
    expect(detectAccountFromUrl('instagram', 'https://www.instagram.com/sudeuzn.05/')).toBe('sudeuzn.05')
    expect(detectAccountFromUrl('instagram', 'https://www.instagram.com/sudeuzn.05/following/')).toBe('sudeuzn.05')
  })

  it('ignores Instagram reserved routes and post pages', () => {
    expect(detectAccountFromUrl('instagram', 'https://www.instagram.com/explore/')).toBeNull()
    expect(detectAccountFromUrl('instagram', 'https://www.instagram.com/p/abc123/')).toBeNull()
  })

  it('detects profile accounts on other supported platforms', () => {
    expect(detectAccountFromUrl('github', 'https://github.com/octocat')).toBe('octocat')
  })
})
