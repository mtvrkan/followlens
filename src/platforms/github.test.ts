import { describe, expect, it } from 'vitest'
import { githubAdapter } from './github'
import type { DomListPage } from './types'

function locationOf(pathname: string, search = ''): Location {
  return { pathname, search } as Location
}

const page: DomListPage = { accountId: 'octocat', accountUsername: 'octocat', direction: 'followers' }

describe('githubAdapter.detectListPage', () => {
  it('detects a followers list page', () => {
    expect(githubAdapter.detectListPage!(locationOf('/octocat', '?tab=followers'))).toEqual({
      accountId: 'octocat',
      accountUsername: 'octocat',
      direction: 'followers',
    })
  })

  it('detects a following list page', () => {
    expect(githubAdapter.detectListPage!(locationOf('/octocat', '?tab=following'))?.direction).toBe('following')
  })

  it('ignores non-list profile pages', () => {
    expect(githubAdapter.detectListPage!(locationOf('/octocat'))).toBeNull()
  })

  it('ignores nested paths (repos, etc.)', () => {
    expect(githubAdapter.detectListPage!(locationOf('/octocat/some-repo', '?tab=followers'))).toBeNull()
  })
})

describe('githubAdapter.openList', () => {
  it('returns false for a nested (non-profile) path', () => {
    window.history.replaceState(null, '', '/octocat/some-repo')
    expect(githubAdapter.openList!('followers')).toBe(false)
  })

  it('returns false for a reserved route', () => {
    window.history.replaceState(null, '', '/settings')
    expect(githubAdapter.openList!('followers')).toBe(false)
  })

  it('reports success without re-navigating when already on that tab', () => {
    window.history.replaceState(null, '', '/octocat?tab=following')
    expect(githubAdapter.openList!('following')).toBe(true)
  })

  it('navigates to the requested tab from the plain profile page', () => {
    window.history.replaceState(null, '', '/octocat')
    expect(githubAdapter.openList!('followers')).toBe(true)
  })
})

describe('githubAdapter.usernameFromUrl', () => {
  it('reads the username off a plain profile page', () => {
    window.history.replaceState(null, '', '/octocat')
    expect(githubAdapter.usernameFromUrl!()).toBe('octocat')
  })

  it('reads the username off an already-open followers tab', () => {
    window.history.replaceState(null, '', '/octocat?tab=followers')
    expect(githubAdapter.usernameFromUrl!()).toBe('octocat')
  })

  it('returns null for a nested (non-profile) path', () => {
    window.history.replaceState(null, '', '/octocat/some-repo')
    expect(githubAdapter.usernameFromUrl!()).toBeNull()
  })

  it('returns null for a reserved route', () => {
    window.history.replaceState(null, '', '/settings')
    expect(githubAdapter.usernameFromUrl!()).toBeNull()
  })
})

describe('githubAdapter.parseUsers (self-fetch)', () => {
  it('maps the followers/following API response array to SocialUser[]', () => {
    const json = [
      { login: 'alice', id: 1, avatar_url: 'https://avatars/a.png' },
      { login: 'bob', id: 2, avatar_url: 'https://avatars/b.png' },
    ]
    expect(githubAdapter.parseUsers!(json)).toEqual([
      { id: '1', username: 'alice', displayName: 'alice', avatarUrl: 'https://avatars/a.png', isVerified: false, isPrivate: false },
      { id: '2', username: 'bob', displayName: 'bob', avatarUrl: 'https://avatars/b.png', isVerified: false, isPrivate: false },
    ])
  })

  it('drops rows with no login, and returns [] for a non-array response', () => {
    expect(githubAdapter.parseUsers!([{ id: 1 }])).toEqual([])
    expect(githubAdapter.parseUsers!({})).toEqual([])
    expect(githubAdapter.parseUsers!(null)).toEqual([])
  })
})

describe('githubAdapter.parseHasMore (self-fetch)', () => {
  it('reports more when the page came back full', () => {
    const fullPage = Array.from({ length: githubAdapter.selfFetch!.pageSize }, (_, i) => ({ login: `u${i}` }))
    expect(githubAdapter.parseHasMore!(fullPage)).toBe(true)
  })

  it('reports no more once a page comes back short', () => {
    expect(githubAdapter.parseHasMore!([{ login: 'alice' }])).toBe(false)
    expect(githubAdapter.parseHasMore!([])).toBe(false)
  })

  it('returns null for a non-array response', () => {
    expect(githubAdapter.parseHasMore!({})).toBeNull()
  })
})

describe('githubAdapter.selfFetch', () => {
  const selfFetch = githubAdapter.selfFetch!

  it('builds the profile lookup URL', () => {
    expect(selfFetch.buildProfileUrl('octocat')).toBe('https://api.github.com/users/octocat')
  })

  it('reads the login as pk and the follower/following counts', () => {
    expect(selfFetch.parseProfile({ login: 'octocat', followers: 10, following: 3 })).toEqual({
      pk: 'octocat',
      followers: 10,
      following: 3,
    })
  })

  it('returns null when the login is missing', () => {
    expect(selfFetch.parseProfile({ followers: 10, following: 3 })).toBeNull()
    expect(selfFetch.parseProfile(null)).toBeNull()
  })

  it('builds the first-page list URL defaulting to page 1', () => {
    expect(selfFetch.buildListUrl('octocat', 'followers', null)).toBe(
      `https://api.github.com/users/octocat/followers?per_page=${selfFetch.pageSize}&page=1`,
    )
  })

  it('builds a later-page list URL from the given cursor', () => {
    expect(selfFetch.buildListUrl('octocat', 'following', '3')).toBe(
      `https://api.github.com/users/octocat/following?per_page=${selfFetch.pageSize}&page=3`,
    )
  })

  it('advances the cursor by one page when the page came back full', () => {
    const fullPage = Array.from({ length: selfFetch.pageSize }, (_, i) => ({ login: `u${i}` }))
    expect(selfFetch.parseNextCursor(fullPage, '1')).toBe('2')
    expect(selfFetch.parseNextCursor(fullPage, null)).toBe('2')
  })

  it('returns null (no more pages) once a page comes back short', () => {
    expect(selfFetch.parseNextCursor([{ login: 'alice' }], '1')).toBeNull()
  })

  // Only CORS-safelisted headers, so the request stays a simple GET: the
  // documented X-GitHub-Api-Version pin would force a preflight GitHub does not
  // allow from a page origin, failing the request outright.
  it('sends no auth/session headers and nothing that would force a CORS preflight', () => {
    expect(selfFetch.requestHeaders()).toEqual({
      Accept: 'application/vnd.github+json',
    })
  })

  it('omits credentials — a wildcard-CORS public API rejects credentialed requests', () => {
    expect(selfFetch.credentials).toBe('omit')
  })

  it('has no buildReferrer — the public API neither needs nor expects one', () => {
    expect(selfFetch.buildReferrer).toBeUndefined()
  })
})

describe('githubAdapter.parseDom', () => {
  it('parses user rows that have an avatar image next to the profile link', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div><img src="https://avatars/a.png"><a href="/alice">Alice</a></div>
      <div><img src="https://avatars/b.png"><a href="/bob">Bob</a></div>
      <nav><a href="/settings">Settings</a></nav>
    `
    const users = githubAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice', 'bob'])
    expect(users[0].avatarUrl).toBe('https://avatars/a.png')
  })

  it('de-duplicates repeated links to the same user', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div><img src="a.png"><a href="/alice">Alice</a></div>
      <div><img src="a2.png"><a href="/alice">Alice again</a></div>
    `
    const users = githubAdapter.parseDom!(root, page)
    expect(users).toHaveLength(1)
  })

  it('skips links with no avatar (nav/mention links, not list rows)', () => {
    const root = document.createElement('div')
    root.innerHTML = `<a href="/alice">Alice</a>`
    expect(githubAdapter.parseDom!(root, page)).toEqual([])
  })

  // report() hands parseDom the whole document, and GitHub's global header
  // carries single-segment profile links next to an avatar too — the signed-in
  // viewer's own among them. Unscoped, those match every test a real row does.
  it('reads only the list itself when the page chrome also has avatar-adjacent profile links', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <header><div><img src="me.png"><a href="/viewer">Your profile</a></div></header>
      <main>
        <div><img src="a.png"><a href="/alice">Alice</a></div>
        <div><img src="b.png"><a href="/bob">Bob</a></div>
      </main>
      <footer><div><img src="s.png"><a href="/some-sponsor">Sponsor</a></div></footer>
    `
    expect(githubAdapter.parseDom!(root, page).map((u) => u.username)).toEqual(['alice', 'bob'])
  })

  it('still reads a bare list fragment that has no main element', () => {
    const root = document.createElement('div')
    root.innerHTML = `<div><img src="a.png"><a href="/alice">Alice</a></div>`
    expect(githubAdapter.parseDom!(root, page).map((u) => u.username)).toEqual(['alice'])
  })

  it('skips reserved routes and the profile owner even when avatar-adjacent', () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div><img src="a.png"><a href="/sponsors">Sponsor</a></div>
      <div><img src="b.png"><a href="/octocat">octocat</a></div>
      <div><img src="c.png"><a href="/alice">Alice</a></div>
    `
    const users = githubAdapter.parseDom!(root, page)
    expect(users.map((u) => u.username)).toEqual(['alice'])
  })
})
