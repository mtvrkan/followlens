import type { PlatformId } from '../platforms/types'

const RESERVED: Record<PlatformId, Set<string>> = {
  instagram: new Set([
    'explore',
    'reels',
    'reel',
    'direct',
    'accounts',
    'stories',
    'archive',
    'legal',
    'web',
    'popular',
    'p',
    'tv',
    'developer',
    'about',
    'challenge',
    'session',
    'graphql',
    'api',
    'ads',
    'business',
    'help',
    'privacy',
    'terms',
    'download',
    'create',
    'emails',
    'settings',
    'topics',
    'locations',
    'hashtag',
    'tags',
    'live',
    'lite',
  ]),
  github: new Set(['features', 'enterprise', 'topics', 'collections', 'trending', 'events', 'marketplace', 'pricing', 'login', 'signup']),
}

function cleanSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

function isReserved(platform: PlatformId, value: string): boolean {
  return RESERVED[platform].has(value.toLowerCase())
}

export function detectAccountFromUrl(platform: PlatformId, urlText: string): string | null {
  let url: URL
  try {
    url = new URL(urlText)
  } catch {
    return null
  }

  const segments = cleanSegments(url.pathname)
  const first = segments[0]
  if (!first) return null

  if (platform === 'instagram') {
    if (isReserved(platform, first)) return null
    if (segments.length === 1) return first
    if (segments.length === 2 && (segments[1] === 'followers' || segments[1] === 'following')) return first
    return null
  }

  if (platform === 'github') {
    if (isReserved(platform, first)) return null
    if (segments.length === 1) return first
    return null
  }

  return null
}
