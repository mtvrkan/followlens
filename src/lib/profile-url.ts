import type { PlatformId } from './types'

/** Landing URL for a platform — used by empty-state CTAs to send the user to the right site. */
export function platformHomeUrl(platform: PlatformId): string {
  switch (platform) {
    case 'github':
      return 'https://github.com/'
    case 'instagram':
      return 'https://www.instagram.com/'
  }
}

export function profileUrl(platform: PlatformId | null, username: string): string {
  // Encoded, not interpolated raw: usernames ultimately come from page-supplied
  // data, and one containing `/`, `?` or `#` would otherwise silently build a
  // link to somewhere else on (or off) the platform — this URL is handed
  // straight to `chrome.tabs.create`, an `<a href>` and the exported HTML
  // report. Real handles are alphanumeric, so encoding is invisible for them.
  const handle = encodeURIComponent(username)
  switch (platform) {
    case 'github':
      return `https://github.com/${handle}`
    case 'instagram':
    default:
      return `https://www.instagram.com/${handle}/`
  }
}
