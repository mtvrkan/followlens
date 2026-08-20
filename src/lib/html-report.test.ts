import { describe, expect, it } from 'vitest'
import { buildPortableHtmlReport, buildReportStrings, type HtmlReportInput } from './html-report'
import type { Row } from './rows'
import type { Snapshot } from './types'

const row: Row = {
  id: '1',
  username: 'alice<script>',
  displayName: 'Alice & Co',
  avatarUrl: '',
  isVerified: false,
  isPrivate: false,
  tags: ['notFollowingBack'],
  ignored: false,
}

const snapshot: Snapshot = {
  id: 1,
  platform: 'instagram',
  accountId: 'acct',
  takenAt: 1_700_000_000_000,
  followers: [],
  following: [],
}

/** Echoes the key back, so a test can assert which key a given piece of chrome came from. */
const echo = (key: string) => `t:${key}`

function report(overrides: Partial<HtmlReportInput> = {}): string {
  return buildPortableHtmlReport({
    appName: 'FollowLens',
    platform: 'instagram',
    accountLabel: '@alice',
    generatedAt: 1_700_000_100_000,
    snapshots: [snapshot],
    rows: [row],
    language: 'en',
    dir: 'ltr',
    strings: buildReportStrings(echo),
    tagLabel: (tag) => `tag:${tag}`,
    ...overrides,
  })
}

describe('buildPortableHtmlReport', () => {
  it('builds a self-contained html report and escapes user content', () => {
    const html = report()

    expect(html).toContain('<!doctype html>')
    expect(html).toContain('alice&lt;script&gt;')
    expect(html).toContain('Alice &amp; Co')
    expect(html).not.toContain('alice<script>')
  })

  it('references no remote asset', () => {
    expect(report()).not.toMatch(/(src|href)="https?:\/\/(?!www\.instagram\.com)/)
  })

  it('takes every piece of chrome from the caller rather than hardcoding English', () => {
    const html = report()

    expect(html).toContain('t:reportTitle')
    expect(html).toContain('t:reportSummary')
    expect(html).toContain('t:reportFooter')
    expect(html).toContain('tag:notFollowingBack')
  })

  it('carries the active language and direction on the document element', () => {
    expect(report({ language: 'ar', dir: 'rtl' })).toContain('<html lang="ar" dir="rtl">')
  })

  it('formats dates and numbers in the report language', () => {
    const big: Snapshot = { ...snapshot, followers: Array.from({ length: 1234 }, () => row) }

    expect(report({ language: 'de', snapshots: [big] })).toContain('1.234')
    expect(report({ language: 'en', snapshots: [big] })).toContain('1,234')
  })

  it('omits the growth section when there is no series', () => {
    expect(report()).not.toContain('t:reportGrowth')
  })

  it('draws a growth chart and table when a series is given', () => {
    const html = report({
      series: [
        { takenAt: 1_700_000_000_000, followers: 10, following: 5, followersDelta: 0, followingDelta: 0 },
        { takenAt: 1_700_086_400_000, followers: 12, following: 5, followersDelta: 2, followingDelta: 0 },
      ],
    })

    expect(html).toContain('t:reportGrowth')
    expect(html).toContain('<svg')
    expect(html).toContain('+2')
  })

  it('does not divide by zero when every point in the series is identical', () => {
    const flat = { takenAt: 1_700_000_000_000, followers: 10, following: 10, followersDelta: 0, followingDelta: 0 }
    const html = report({ series: [flat, { ...flat, takenAt: 1_700_086_400_000 }] })

    expect(html).toContain('<svg')
    expect(html).not.toContain('NaN')
  })

  it('shows the empty state instead of a table when no rows are selected', () => {
    const html = report({ rows: [] })

    expect(html).toContain('t:reportEmptyResults')
    expect(html).not.toContain('<tbody><tr>')
  })

  it('drops the results section entirely when no row list is supplied at all', () => {
    const html = report({ rows: undefined })

    expect(html).not.toContain('t:reportResults')
    expect(html).not.toContain('t:reportEmptyResults')
    expect(html).toContain('t:reportSummary')
  })
})
