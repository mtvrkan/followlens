import { describe, expect, it } from 'vitest'
import { findNextPageLink, isForwardPage } from './next-page'

const FOLLOWERS = 'https://github.com/octocat?tab=followers'
// What GitHub's own Next button actually points at on a followers tab: an
// opaque cursor, no page number anywhere.
const CURSOR_PAGE_2 = 'https://github.com/octocat?tab=followers&after=Y3Vyc29yOnYyOpHOAAExDQ%3D%3D'

function listWith(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('isForwardPage', () => {
  // The regression this module exists for: requiring a greater `page=` param
  // rejected every cursor link, so the GitHub DOM walk stopped after page one
  // and reported ~50 followers as the whole list.
  it('accepts a cursor link that carries no page number at all', () => {
    expect(isForwardPage(CURSOR_PAGE_2, FOLLOWERS)).toBe(true)
  })

  it('accepts a relative cursor link', () => {
    expect(isForwardPage('?tab=followers&after=abc123', FOLLOWERS)).toBe(true)
  })

  it('refuses the page it is already on', () => {
    expect(isForwardPage(FOLLOWERS, FOLLOWERS)).toBe(false)
  })

  it('refuses a page already walked, which is what stops a cursor loop', () => {
    expect(isForwardPage(CURSOR_PAGE_2, FOLLOWERS, new Set([CURSOR_PAGE_2]))).toBe(false)
  })

  it('still orders page-numbered links, so a numbered Previous cannot win', () => {
    const page3 = 'https://github.com/octocat?tab=followers&page=3'
    expect(isForwardPage('https://github.com/octocat?tab=followers&page=4', page3)).toBe(true)
    expect(isForwardPage('https://github.com/octocat?tab=followers&page=2', page3)).toBe(false)
  })

  it('refuses a link that leaves this profile or this origin', () => {
    expect(isForwardPage('https://github.com/someone-else?tab=followers&after=x', FOLLOWERS)).toBe(false)
    expect(isForwardPage('https://evil.example/octocat?tab=followers&after=x', FOLLOWERS)).toBe(false)
  })

  it('refuses an unparseable href rather than throwing', () => {
    expect(isForwardPage('http://[', FOLLOWERS)).toBe(false)
  })
})

describe('findNextPageLink', () => {
  it('follows a cursor-based rel="next" link', () => {
    const root = listWith(`
      <a rel="prev" href="?tab=followers&before=zzz">Previous</a>
      <a rel="next" href="?tab=followers&after=abc123">Next</a>
    `)
    expect(findNextPageLink(root, FOLLOWERS)?.getAttribute('href')).toBe('?tab=followers&after=abc123')
  })

  // GitHub localizes its UI into ten languages, so the visible label cannot be
  // the primary signal — rel="next" carries no language at all.
  it('follows rel="next" even when the label is in a language nothing matches', () => {
    const root = listWith(`<a rel="next" href="?tab=followers&after=abc">Επόμενη</a>`)
    expect(findNextPageLink(root, FOLLOWERS)).not.toBeNull()
  })

  it('falls back to a labelled link when neither attribute is present', () => {
    const root = listWith(`
      <a href="?tab=followers&before=zzz">Previous</a>
      <a href="?tab=followers&after=abc123">Next</a>
    `)
    expect(findNextPageLink(root, FOLLOWERS)?.getAttribute('href')).toBe('?tab=followers&after=abc123')
  })

  it('never picks the Previous control, even labelled and cursor-based', () => {
    const root = listWith(`<a href="?tab=followers&before=zzz">Previous</a>`)
    expect(findNextPageLink(root, FOLLOWERS)).toBeNull()
  })

  it('returns null on the last page, where Next is rendered disabled with no href', () => {
    const root = listWith(`
      <a href="?tab=followers&before=zzz">Previous</a>
      <span aria-disabled="true">Next</span>
      <a>Next</a>
    `)
    expect(findNextPageLink(root, FOLLOWERS)).toBeNull()
  })

  it('skips a next link back to an already-walked page and keeps looking', () => {
    const walked = 'https://github.com/octocat?tab=followers&after=first'
    const root = listWith(`
      <a rel="next" href="?tab=followers&after=first">Next</a>
      <a href="?tab=followers&after=second">Next</a>
    `)
    expect(findNextPageLink(root, FOLLOWERS, new Set([walked]))?.getAttribute('href')).toBe('?tab=followers&after=second')
  })

  it('ignores prose that merely contains the word', () => {
    const root = listWith(`<a href="?tab=followers&after=abc">Next page of results</a>`)
    expect(findNextPageLink(root, FOLLOWERS)).toBeNull()
  })
})
