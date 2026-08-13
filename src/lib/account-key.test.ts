import { describe, expect, it } from 'vitest'
import { accountKey } from './account-key'

describe('accountKey', () => {
  it('joins platform and accountId with a colon', () => {
    expect(accountKey('instagram', '12345')).toBe('instagram:12345')
  })

  it('keeps different platforms with the same accountId distinct', () => {
    expect(accountKey('instagram', '1')).not.toBe(accountKey('github', '1'))
  })
})
