import { describe, expect, it } from 'vitest'
import {
  getAdapterForHost,
  getDomAdapterForHost,
  manifestMatchPatterns,
  manifestMatchPatternsForMode,
  manifestMatchPatternsForInjectedScript,
  matchJsonRequest,
} from './registry'

describe('getAdapterForHost', () => {
  it('matches a bare registered hostname', () => {
    expect(getAdapterForHost('instagram.com')?.id).toBe('instagram')
  })

  it('matches subdomains of a registered hostname', () => {
    expect(getAdapterForHost('www.instagram.com')?.id).toBe('instagram')
  })

  it('does not match unrelated hosts, including near-miss suffixes', () => {
    expect(getAdapterForHost('notinstagram.com')).toBeNull()
    expect(getAdapterForHost('example.com')).toBeNull()
  })

  // TikTok and X were removed; their hostnames must resolve to nothing rather
  // than falling through to some other platform's adapter.
  it('does not resolve hostnames of removed platforms', () => {
    expect(getAdapterForHost('tiktok.com')).toBeNull()
    expect(getAdapterForHost('www.tiktok.com')).toBeNull()
    expect(getAdapterForHost('x.com')).toBeNull()
    expect(getAdapterForHost('twitter.com')).toBeNull()
  })
})

describe('getDomAdapterForHost', () => {
  it('only returns dom-mode adapters', () => {
    expect(getDomAdapterForHost('github.com')?.id).toBe('github')
    expect(getDomAdapterForHost('instagram.com')?.id).toBe('instagram')
    expect(getDomAdapterForHost('example.com')).toBeNull()
  })
})

describe('matchJsonRequest', () => {
  it('returns null for a github URL (dom-mode adapter has no matchRequest)', () => {
    expect(matchJsonRequest('https://github.com/someone/followers', 'github.com')).toBeNull()
  })

  it('matches Instagram\'s friendship API despite it being a dom-mode adapter — matchRequest is a supplementary capability, not tied to mode', () => {
    const match = matchJsonRequest('https://www.instagram.com/api/v1/friendships/123/followers/?count=12', 'www.instagram.com')
    expect(match?.adapter.id).toBe('instagram')
    expect(match?.accountId).toBe('123')
    expect(match?.direction).toBe('followers')
  })

  it('returns null for an unrelated hostname', () => {
    expect(matchJsonRequest('https://example.com/i/api/graphql/abc123/Followers', 'example.com')).toBeNull()
  })

  it('does not attribute a request to a platform just because its path happens to match', () => {
    // Regression: matchJsonRequest used to loop over every adapter regardless
    // of which platform's page issued the request, so any page fetching an
    // Instagram-shaped path was misattributed to Instagram.
    const url = 'https://sometrackingdomain.example/api/v1/friendships/123/followers/'
    expect(matchJsonRequest(url, 'sometrackingdomain.example')).toBeNull()
  })
})

describe('manifest match patterns', () => {
  it('splits json/dom adapters into the right pattern buckets', () => {
    const jsonPatterns = manifestMatchPatternsForMode('json')
    const domPatterns = manifestMatchPatternsForMode('dom')
    expect(jsonPatterns.some((p) => p.includes('instagram.com'))).toBe(false)
    expect(domPatterns.some((p) => p.includes('instagram.com'))).toBe(true)
    expect(domPatterns.some((p) => p.includes('github.com'))).toBe(true)
    expect(jsonPatterns.some((p) => p.includes('github.com'))).toBe(false)
  })

  it('combines both modes without duplicates dropped incorrectly', () => {
    const all = manifestMatchPatterns()
    const jsonPatterns = manifestMatchPatternsForMode('json')
    const domPatterns = manifestMatchPatternsForMode('dom')
    expect(all.length).toBe(jsonPatterns.length + domPatterns.length)
  })

  it('grants the injected-script host list to dom-mode adapters that need the MAIN world', () => {
    const patterns = manifestMatchPatternsForInjectedScript()
    // Instagram: dom-mode, but wants network interception as a second source.
    expect(patterns.some((p) => p.includes('instagram.com'))).toBe(true)
    // GitHub: nothing to intercept (no matchRequest), but its selfFetch runs in
    // the MAIN world — leaving it out is what made START_SELF_FETCH go nowhere.
    expect(patterns.some((p) => p.includes('github.com'))).toBe(true)
  })
})
