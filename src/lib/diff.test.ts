import { describe, expect, it } from 'vitest'
import { diffSnapshots } from './diff'
import type { Snapshot, SocialUser } from './types'

function user(username: string): SocialUser {
  return { id: username, username, displayName: username, avatarUrl: '', isVerified: false, isPrivate: false }
}

function snapshot(followers: string[], following: string[]): Snapshot {
  return {
    platform: 'instagram',
    accountId: 'acc',
    takenAt: 0,
    followers: followers.map(user),
    following: following.map(user),
  }
}

describe('diffSnapshots', () => {
  it('treats every follower/following as new when there is no previous snapshot', () => {
    const diff = diffSnapshots(undefined, snapshot(['a', 'b'], ['a']))
    expect(diff.newFollowers.map((u) => u.username)).toEqual(['a', 'b'])
    expect(diff.newFollowing.map((u) => u.username)).toEqual(['a'])
    expect(diff.lostFollowers).toEqual([])
    expect(diff.lostFollowing).toEqual([])
  })

  it('detects new and lost followers between two snapshots', () => {
    const previous = snapshot(['a', 'b'], [])
    const current = snapshot(['b', 'c'], [])
    const diff = diffSnapshots(previous, current)
    expect(diff.newFollowers.map((u) => u.username)).toEqual(['c'])
    expect(diff.lostFollowers.map((u) => u.username)).toEqual(['a'])
  })

  it('flags following accounts that do not follow back', () => {
    const current = snapshot(['a'], ['a', 'b'])
    const diff = diffSnapshots(undefined, current)
    expect(diff.notFollowingBack.map((u) => u.username)).toEqual(['b'])
  })

  it('returns no diffs when nothing changed', () => {
    const snap = snapshot(['a', 'b'], ['a'])
    const diff = diffSnapshots(snap, snap)
    expect(diff.newFollowers).toEqual([])
    expect(diff.lostFollowers).toEqual([])
    expect(diff.newFollowing).toEqual([])
    expect(diff.lostFollowing).toEqual([])
  })

  it('matches a renamed user by stable id instead of reporting a lost+new pair', () => {
    const idUser = (id: string, username: string): SocialUser => ({
      id,
      username,
      displayName: username,
      avatarUrl: '',
      isVerified: false,
      isPrivate: false,
    })
    const previous: Snapshot = {
      platform: 'github',
      accountId: 'acc',
      takenAt: 0,
      followers: [idUser('stable-id-1', 'old_handle')],
      following: [],
    }
    const current: Snapshot = {
      platform: 'github',
      accountId: 'acc',
      takenAt: 1,
      followers: [idUser('stable-id-1', 'new_handle')],
      following: [],
    }
    const diff = diffSnapshots(previous, current)
    expect(diff.newFollowers).toEqual([])
    expect(diff.lostFollowers).toEqual([])
  })

  // One scan mixes sources with different identity spaces (Instagram's DOM
  // scrape uses the username as `id`, its network/self-fetch path uses the
  // numeric pk) — matching on `id` first used to read that as a completely
  // different set of people.
  it('matches the same follower across scans collected via different sources (username id vs numeric id)', () => {
    const domUser: SocialUser = { id: 'alice', username: 'alice', displayName: 'Alice', avatarUrl: '', isVerified: false, isPrivate: false }
    const apiUser: SocialUser = { id: '17841400000', username: 'alice', displayName: 'Alice', avatarUrl: '', isVerified: false, isPrivate: false }
    const previous: Snapshot = { platform: 'instagram', accountId: 'acc', takenAt: 0, followers: [domUser], following: [] }
    const current: Snapshot = { platform: 'instagram', accountId: 'acc', takenAt: 1, followers: [apiUser], following: [] }

    const diff = diffSnapshots(previous, current)

    expect(diff.newFollowers).toEqual([])
    expect(diff.lostFollowers).toEqual([])
  })

  it('does not flag someone as not-following-back when the two directions carry different id spaces', () => {
    const follower: SocialUser = { id: '17841400000', username: 'alice', displayName: 'Alice', avatarUrl: '', isVerified: false, isPrivate: false }
    const followed: SocialUser = { id: 'alice', username: 'alice', displayName: 'Alice', avatarUrl: '', isVerified: false, isPrivate: false }
    const current: Snapshot = { platform: 'instagram', accountId: 'acc', takenAt: 0, followers: [follower], following: [followed] }

    const diff = diffSnapshots(undefined, current)

    expect(diff.notFollowingBack).toEqual([])
  })

  it('treats a username re-reported under different casing as the same person', () => {
    const previous = snapshot(['Alice'], [])
    const current = snapshot(['alice'], [])

    const diff = diffSnapshots(previous, current)

    expect(diff.newFollowers).toEqual([])
    expect(diff.lostFollowers).toEqual([])
  })

  it('carries the current snapshot\'s full lists, so a first scan still has something to show', () => {
    const diff = diffSnapshots(undefined, snapshot(['a', 'b'], ['b', 'c']))

    expect(diff.allFollowers.map((u) => u.username)).toEqual(['a', 'b'])
    expect(diff.allFollowing.map((u) => u.username)).toEqual(['b', 'c'])
  })

  it('reports only the current snapshot in the full lists — people who left are not in them', () => {
    const diff = diffSnapshots(snapshot(['gone'], []), snapshot(['stayed'], []))

    expect(diff.lostFollowers.map((u) => u.username)).toEqual(['gone'])
    expect(diff.allFollowers.map((u) => u.username)).toEqual(['stayed'])
  })

  it('dedupes the full lists the same way the categories are deduped', () => {
    const current: Snapshot = {
      platform: 'instagram',
      accountId: 'acc',
      takenAt: 0,
      followers: [user('Alice'), user('alice')],
      following: [],
    }

    expect(diffSnapshots(undefined, current).allFollowers).toHaveLength(1)
  })
})
