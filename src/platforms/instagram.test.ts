import { beforeEach, describe, expect, it, vi } from 'vitest'
import { instagramAdapter } from './instagram'
import type { DomListPage } from './types'

function locationOf(pathname: string): Location {
  return { pathname } as Location
}

// Clears leftover header/dialog nodes between tests so getListDialog()'s
// document-wide lookup can't leak an open dialog into an unrelated test.
beforeEach(() => {
  document.body.innerHTML = ''
})

async function freshAdapter() {
  vi.resetModules()
  document.body.innerHTML = ''
  const mod = await import('./instagram')
  return mod.instagramAdapter
}

// Simulates the followers/following modal being on screen — its presence is
// what detectListPage/parseDom now require to treat a list as open.
function openDialog(): void {
  const dialog = document.createElement('div')
  dialog.setAttribute('role', 'dialog')
  document.body.appendChild(dialog)
}

function addHeaderStats(labels: string[]): HTMLElement {
  const header = document.createElement('header')
  header.innerHTML = labels.map((label) => `<a role="link" href="#">${label}</a>`).join('')
  document.body.appendChild(header)
  return header
}

function addHeaderStatBlocks(): HTMLElement {
  const header = document.createElement('header')
  header.innerHTML = `
    <div><span>1 gönderi</span></div>
    <div><span>131 takipçi</span></div>
    <div><span>155 takip</span></div>
  `
  document.body.appendChild(header)
  return header
}

function clickHeaderStat(index: number, labels: string[]) {
  const header = addHeaderStats(labels)
  header.querySelectorAll('a')[index].dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

function clickHeaderStatBlock(index: number): void {
  const header = addHeaderStatBlocks()
  header.querySelectorAll('span')[index].dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('instagramAdapter.detectListPage', () => {
  it('returns null when the list dialog is not open, even after a stat click', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStat(0, ['130 takipçi', '155 takip'])
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))).toBeNull()
  })

  it('returns null when a dialog is open but no direction is known', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))).toBeNull()
  })

  it('detects followers after clicking the first numeric header stat', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStat(0, ['130 takipçi', '155 takip'])
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))).toEqual({
      accountId: 'jane.doe',
      accountUsername: 'jane.doe',
      direction: 'followers',
    })
  })

  it('detects followers when the click lands on a nested non-link stat label', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStatBlock(1)
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))?.direction).toBe('followers')
  })

  it('detects following when the click lands on a nested non-link stat label', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStatBlock(2)
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))?.direction).toBe('following')
  })

  it('detects following after clicking the second numeric header stat, regardless of label language', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStat(1, ['130 followers', '155 following'])
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))?.direction).toBe('following')
  })

  it('reads direction and account straight from the list URL when Instagram reflects it', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    openDialog()
    // No click needed — the URL names the direction unambiguously.
    expect(adapter.detectListPage!(locationOf('/jane.doe/following/'))).toEqual({
      accountId: 'jane.doe',
      accountUsername: 'jane.doe',
      direction: 'following',
    })
  })

  it('reads direction from the list URL even with no dialog on screen (a freshly-navigated list page)', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    // No openDialog() call — a direct navigation to the URL may render the
    // list without the modal wrapper a click-opened one gets.
    expect(adapter.detectListPage!(locationOf('/jane.doe/followers/'))).toEqual({
      accountId: 'jane.doe',
      accountUsername: 'jane.doe',
      direction: 'followers',
    })
  })

  it('ignores non-numeric header links (username, edit profile, etc.)', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStat(0, ['jane.doe', '130 takipçi'])
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))).toBeNull()
  })

  it('returns null off a non-profile route even with a dialog open and a stat clicked', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    clickHeaderStat(0, ['130 takipçi', '155 takip'])
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/reels/'))).toBeNull()
  })
})

describe('instagramAdapter.openList', () => {
  it('returns false when the current URL has no username to build a list URL from', async () => {
    const adapter = await freshAdapter()
    window.history.replaceState(null, '', '/explore/')
    expect(adapter.openList!('followers')).toBe(false)
  })

  it('clicks the followers/following stat for the current profile', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    window.history.replaceState(null, '', '/jane.doe/')
    addHeaderStats(['130 takipçi', '155 takip'])

    expect(adapter.openList!('following')).toBe(true)
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))?.direction).toBe('following')
  })

  it('uses the last two numeric controls when posts are also clickable', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    window.history.replaceState(null, '', '/jane.doe/')
    addHeaderStats(['1 gönderi', '130 takipçi', '155 takip'])

    expect(adapter.openList!('followers')).toBe(true)
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))?.direction).toBe('followers')
  })

  it('finds follower controls rendered as non-link blocks', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    window.history.replaceState(null, '', '/jane.doe/')
    addHeaderStatBlocks()

    expect(adapter.openList!('following')).toBe(true)
    openDialog()
    expect(adapter.detectListPage!(locationOf('/jane.doe/'))?.direction).toBe('following')
  })

  it('does not click the same list control again while that dialog is already open', async () => {
    const adapter = await freshAdapter()
    adapter.init!()
    window.history.replaceState(null, '', '/jane.doe/')
    const header = addHeaderStats(['130 takipçi', '155 takip'])
    let clicks = 0
    header.querySelectorAll('a')[0].addEventListener('click', () => {
      clicks += 1
    })

    expect(adapter.openList!('followers')).toBe(true)
    expect(clicks).toBeGreaterThan(0)
    openDialog()
    clicks = 0

    expect(adapter.openList!('followers')).toBe(true)
    expect(clicks).toBe(0)
  })
})

// openList re-clicks on a timer because some Instagram builds ignore the
// first dispatched (non-trusted) click. Those timers know nothing about
// whether the scan is still running, so they have to be abandonable — see
// cancelPendingOpen in platforms/types.ts.
describe('instagramAdapter.cancelPendingOpen', () => {
  async function armPendingOpen() {
    const adapter = await freshAdapter()
    adapter.init!()
    window.history.replaceState(null, '', '/jane.doe/')
    const header = addHeaderStats(['130 takipçi', '155 takip'])
    let clicks = 0
    header.querySelectorAll('a')[0].addEventListener('click', () => {
      clicks += 1
    })

    vi.useFakeTimers()
    expect(adapter.openList!('followers')).toBe(true)
    // The immediate click; the dialog is deliberately never opened here, so
    // the two re-clicks stay queued.
    expect(clicks).toBe(1)
    return { adapter, clicks: () => clicks }
  }

  it('stops a queued re-click from opening the dialog after collection was stopped', async () => {
    const { adapter, clicks } = await armPendingOpen()
    try {
      adapter.cancelPendingOpen!()
      vi.advanceTimersByTime(5000)
      expect(clicks()).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('still retries when nothing cancelled it', async () => {
    const { clicks } = await armPendingOpen()
    try {
      vi.advanceTimersByTime(5000)
      expect(clicks()).toBeGreaterThan(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('is superseded by a new openList rather than racing it', async () => {
    const { adapter, clicks } = await armPendingOpen()
    try {
      // The reopen path (scrollDirectionToCompletion) calls openList again;
      // the previous call's queued re-clicks must not fire on top of it.
      adapter.openList!('followers')
      adapter.cancelPendingOpen!()
      vi.advanceTimersByTime(5000)
      expect(clicks()).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('instagramAdapter.parseDom', () => {
  const page: DomListPage = { accountId: 'mtvrkan', accountUsername: 'mtvrkan', direction: 'followers' }

  it('parses role="link" profile rows', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div><a role="link" href="/alice"><img src="alice.png"></a><a role="link" href="/alice"><span>Alice A.</span></a></div>
      <div><a role="link" href="/bob"><img src="bob.png"></a><a role="link" href="/bob"><span>Bob B.</span></a></div>
    `
    const users = instagramAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice', 'bob'])
    expect(users[0].displayName).toBe('Alice A.')
    expect(users[0].avatarUrl).toBe('alice.png')
  })

  it('parses current Instagram profile-link variants without requiring role="link"', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div>
        <a href="https://www.instagram.com/alice/?igsh=abc"><img src="alice.png"><span>Alice A.</span></a>
        <a href="/bob/?next=%2F"><span>Bob B.</span></a>
      </div>
    `
    const users = instagramAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice', 'bob'])
  })

  it('excludes Instagram\'s reserved top-level routes (nav bar / footer false positives)', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <a role="link" href="/reels/">Reels</a>
      <a role="link" href="/explore/">Explore</a>
      <a role="link" href="/popular/">Popular</a>
      <div><a role="link" href="/alice"><img src="a.png"></a></div>
    `
    const users = instagramAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice'])
  })

  it('excludes the profile owner\'s own link', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <a role="link" href="/mtvrkan/">Own profile</a>
      <div><a role="link" href="/alice"><img src="a.png"></a></div>
    `
    const users = instagramAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice'])
  })

  it('ignores profile-shaped links that are not marked role="link"', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <a href="/not-a-row/">Not a row</a>
      <div><a role="link" href="/alice"><img src="alice.png"></a></div>
    `
    const users = instagramAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice'])
  })

  it('de-duplicates repeated links to the same user within a row', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div><a role="link" href="/alice"><img src="alice.png"></a><a role="link" href="/alice">Alice</a></div>
    `
    expect(instagramAdapter.parseDom!(root, page)).toHaveLength(1)
  })

  it('still includes a row when no avatar image is found nearby', () => {
    const root = document.createElement('div')
    root.innerHTML = `<a role="link" href="/alice">Alice</a>`
    const users = instagramAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice'])
    expect(users[0].avatarUrl).toBe('')
  })

  it('falls back to username as displayName when no other label is found', () => {
    const root = document.createElement('div')
    root.innerHTML = `<div><a role="link" href="/alice"><img src="a.png"></a></div>`
    const users = instagramAdapter.parseDom!(root, page)
    expect(users[0].displayName).toBe('alice')
  })
})

describe('instagramAdapter.matchRequest', () => {
  it('matches the followers friendship API request and extracts accountId + direction', () => {
    const match = instagramAdapter.matchRequest!('https://www.instagram.com/api/v1/friendships/39879268470/followers/?count=12&search_surface=follow_list_page')
    expect(match).toEqual({ accountId: '39879268470', direction: 'followers' })
  })

  it('matches the following friendship API request', () => {
    const match = instagramAdapter.matchRequest!('https://www.instagram.com/api/v1/friendships/39879268470/following/?count=12')
    expect(match).toEqual({ accountId: '39879268470', direction: 'following' })
  })

  it('returns null for an unrelated Instagram API request', () => {
    expect(instagramAdapter.matchRequest!('https://www.instagram.com/api/v1/feed/timeline/')).toBeNull()
  })
})

describe('instagramAdapter.parseUsers', () => {
  it('maps the friendship API response shape to SocialUser[]', () => {
    const json = {
      users: [
        { pk: '72322224198', username: 'mtvrkan', full_name: 'Mehmet Türkan', profile_pic_url: 'https://example.com/a.jpg', is_verified: false, is_private: true },
        { pk: '69936184167', username: 'gayir.gokhan', full_name: 'Gökhan gayır', profile_pic_url: 'https://example.com/b.jpg', is_verified: true, is_private: false },
      ],
    }
    const users = instagramAdapter.parseUsers!(json)
    expect(users).toEqual([
      { id: '72322224198', username: 'mtvrkan', displayName: 'Mehmet Türkan', avatarUrl: 'https://example.com/a.jpg', isVerified: false, isPrivate: true },
      { id: '69936184167', username: 'gayir.gokhan', displayName: 'Gökhan gayır', avatarUrl: 'https://example.com/b.jpg', isVerified: true, isPrivate: false },
    ])
  })

  it('falls back to username as displayName when full_name is empty, and drops rows with no username', () => {
    const json = { users: [{ pk: '1', username: 'noname', full_name: '' }, { pk: '2' }] }
    const users = instagramAdapter.parseUsers!(json)
    expect(users).toEqual([{ id: '1', username: 'noname', displayName: 'noname', avatarUrl: '', isVerified: false, isPrivate: false }])
  })

  it('returns an empty array for a malformed or unexpected response shape', () => {
    expect(instagramAdapter.parseUsers!({})).toEqual([])
    expect(instagramAdapter.parseUsers!(null)).toEqual([])
    expect(instagramAdapter.parseUsers!({ users: 'not-an-array' })).toEqual([])
  })
})

describe('instagramAdapter.parseHasMore', () => {
  it('reads has_more: true from the friendship API response', () => {
    expect(instagramAdapter.parseHasMore!({ has_more: true })).toBe(true)
  })

  it('reads has_more: false from the friendship API response', () => {
    expect(instagramAdapter.parseHasMore!({ has_more: false })).toBe(false)
  })

  it('returns null when has_more is missing or the response shape is unexpected', () => {
    expect(instagramAdapter.parseHasMore!({})).toBeNull()
    expect(instagramAdapter.parseHasMore!(null)).toBeNull()
    expect(instagramAdapter.parseHasMore!({ has_more: 'yes' })).toBeNull()
  })
})

describe('instagramAdapter.selfFetch', () => {
  const selfFetch = instagramAdapter.selfFetch!

  describe('buildProfileUrl', () => {
    it('builds the web_profile_info lookup URL for a username', () => {
      expect(selfFetch.buildProfileUrl('mtvrkan')).toBe(
        'https://www.instagram.com/api/v1/users/web_profile_info/?username=mtvrkan',
      )
    })

    it('URL-encodes a username with special characters', () => {
      expect(selfFetch.buildProfileUrl('a b&c')).toBe(
        'https://www.instagram.com/api/v1/users/web_profile_info/?username=a%20b%26c',
      )
    })
  })

  describe('parseProfile', () => {
    it('reads the numeric pk and exact follower/following totals', () => {
      const json = { data: { user: { id: '39879268470', edge_followed_by: { count: 139 }, edge_follow: { count: 155 } } } }
      expect(selfFetch.parseProfile(json)).toEqual({ pk: '39879268470', followers: 139, following: 155 })
    })

    it('reads null for a missing count field instead of failing the whole lookup (pk is still usable)', () => {
      const json = { data: { user: { id: '1', edge_followed_by: { count: 10 } } } }
      expect(selfFetch.parseProfile(json)).toEqual({ pk: '1', followers: 10, following: null })
    })

    it('returns null when even the pk is missing', () => {
      const json = { data: { user: { edge_followed_by: { count: 10 }, edge_follow: { count: 5 } } } }
      expect(selfFetch.parseProfile(json)).toBeNull()
    })

    it('returns null for a malformed or unexpected response shape', () => {
      expect(selfFetch.parseProfile({})).toBeNull()
      expect(selfFetch.parseProfile(null)).toBeNull()
      expect(selfFetch.parseProfile({ data: { user: null } })).toBeNull()
    })
  })

  describe('buildListUrl', () => {
    it('builds the first-page followers URL with search_surface, matching the real captured request', () => {
      const url = selfFetch.buildListUrl('39879268470', 'followers', null)
      expect(url).toBe(`https://www.instagram.com/api/v1/friendships/39879268470/followers/?count=${selfFetch.pageSize}&search_surface=follow_list_page`)
    })

    it('builds the first-page following URL without search_surface, matching the real captured request', () => {
      const url = selfFetch.buildListUrl('39879268470', 'following', null)
      expect(url).toBe(`https://www.instagram.com/api/v1/friendships/39879268470/following/?count=${selfFetch.pageSize}`)
    })

    it('appends max_id when a cursor is given', () => {
      const url = selfFetch.buildListUrl('39879268470', 'following', 'abc123')
      expect(url).toBe(`https://www.instagram.com/api/v1/friendships/39879268470/following/?count=${selfFetch.pageSize}&max_id=abc123`)
    })

    it('appends max_id after search_surface for followers', () => {
      const url = selfFetch.buildListUrl('39879268470', 'followers', 'abc123')
      expect(url).toBe(`https://www.instagram.com/api/v1/friendships/39879268470/followers/?count=${selfFetch.pageSize}&search_surface=follow_list_page&max_id=abc123`)
    })
  })

  describe('parseNextCursor', () => {
    it('reads next_max_id when present', () => {
      expect(selfFetch.parseNextCursor({ next_max_id: 'abc123' })).toBe('abc123')
    })

    it('returns null when next_max_id is missing, empty, or the response shape is unexpected', () => {
      expect(selfFetch.parseNextCursor({})).toBeNull()
      expect(selfFetch.parseNextCursor({ next_max_id: '' })).toBeNull()
      expect(selfFetch.parseNextCursor(null)).toBeNull()
      expect(selfFetch.parseNextCursor({ next_max_id: 123 })).toBeNull()
    })
  })

  it('sends an empty CSRF token when the csrftoken cookie is absent, rather than throwing', () => {
    expect(selfFetch.requestHeaders()['X-CSRFToken']).toBe('')
  })

  it('sends the app id, XHR marker, and CSRF token headers the private API requires', () => {
    document.cookie = 'csrftoken=abc123; path=/'
    expect(selfFetch.requestHeaders()).toEqual({
      'X-IG-App-ID': '936619743392459',
      'X-Requested-With': 'XMLHttpRequest',
      'X-CSRFToken': 'abc123',
    })
  })

  it('paces requests with a positive, ordered delay range', () => {
    expect(selfFetch.pageSize).toBeGreaterThan(0)
    expect(selfFetch.minDelayMs).toBeGreaterThan(0)
    expect(selfFetch.maxDelayMs).toBeGreaterThanOrEqual(selfFetch.minDelayMs)
  })
})
