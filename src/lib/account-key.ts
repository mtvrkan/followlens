import type { PlatformId } from '../platforms/types'

/** Shared key format for everything keyed by platform+account: snapshot buffers, account labels, etc. */
export function accountKey(platform: PlatformId, accountId: string): string {
  return `${platform}:${accountId}`
}
