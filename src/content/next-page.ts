/**
 * Picking the "next page" link on a server-paginated list (GitHub's
 * followers/following tabs). Pure and DOM-only — no chrome APIs, no
 * navigation — so the decision itself is testable without the whole content
 * script's side effects.
 *
 * GitHub paginates these tabs with opaque cursors, not page numbers:
 *
 *     /octocat?tab=followers&after=Y3Vyc29yOnYyOpHOAAExDQ%3D%3D
 *
 * The previous version of this logic required a candidate link to carry a
 * numerically greater `page=` than the current URL before it would be
 * followed. No cursor URL carries `page=` at all, so both sides fell back to
 * 1, `1 > 1` was false, and every real Next link was rejected — the DOM walk
 * ended after the first page and reported ~50 followers as the complete list.
 * With no `expectedCount` for GitHub and no previous snapshot to compare
 * against, a first-ever scan then saved that silently, and every "not
 * following back" result computed from it was wrong.
 *
 * Page numbers are still honoured where they do appear (older GitHub markup
 * and other listings that paginate that way). What the numeric check was
 * really there for — never walking backwards or in a circle — is enforced
 * directly instead, by refusing any URL this tab has already been on, which
 * works for cursors and page numbers alike.
 */

/**
 * `rel="next"` is the semantic, language-independent signal and cannot match a
 * "Previous" control, so it is tried first and on its own. GitHub localizes
 * its UI into ten languages, which is exactly why matching the visible label
 * cannot be the primary path.
 */
const NEXT_LINK_SELECTOR = 'a[rel="next"], a.next_page'

/**
 * Last-resort label match for builds that render Next as a plain anchor with
 * neither attribute. Best-effort across GitHub's own UI languages plus
 * Turkish — deliberately anchored so it can't match "Next page of results" or
 * similar prose, and never the Previous control.
 */
const NEXT_LABEL_RE =
  /^(next|sonraki|siguiente|suivant|weiter|nächste|próxima|próximo|次へ|下一页|下一頁|다음|следующая|далее)$/i

function labelledNextLinks(root: ParentNode): HTMLAnchorElement[] {
  return [...root.querySelectorAll<HTMLAnchorElement>('a')].filter((anchor) =>
    NEXT_LABEL_RE.test(anchor.textContent?.trim() ?? ''),
  )
}

/**
 * Whether `href` genuinely moves the walk forward from `currentUrl`.
 * Exported for the tests that pin the cursor-vs-page-number behavior.
 */
export function isForwardPage(href: string, currentUrl: string, visited: ReadonlySet<string> = new Set()): boolean {
  let candidate: URL
  let current: URL
  try {
    current = new URL(currentUrl)
    candidate = new URL(href, currentUrl)
  } catch {
    return false
  }

  // Standing still or revisiting is the loop this guard exists to prevent.
  if (candidate.href === current.href || visited.has(candidate.href)) return false

  // A link that leaves the profile whose list is being walked is not this
  // list's next page, whatever its label says.
  if (candidate.origin !== current.origin || candidate.pathname !== current.pathname) return false

  const candidatePage = candidate.searchParams.get('page')
  const currentPage = current.searchParams.get('page')
  // Both page-numbered: keep the original ordering check, so a numbered
  // "Previous" link still can't win.
  if (candidatePage != null && currentPage != null) return Number(candidatePage) > Number(currentPage)

  return true
}

/**
 * The next-page link to follow, or null when the list is exhausted.
 * `visited` carries the URLs this tab has already walked (see the content
 * script's sessionStorage-backed record) so the guard survives the full page
 * reload each step costs.
 */
export function findNextPageLink(
  root: ParentNode,
  currentUrl: string,
  visited: ReadonlySet<string> = new Set(),
): HTMLAnchorElement | null {
  const candidates = [...root.querySelectorAll<HTMLAnchorElement>(NEXT_LINK_SELECTOR), ...labelledNextLinks(root)]

  for (const candidate of candidates) {
    // `href` (the resolved property) is empty for an anchor with no href
    // attribute; getAttribute keeps relative values usable in a detached DOM.
    const href = candidate.getAttribute('href')
    if (!href) continue
    if (isForwardPage(href, currentUrl, visited)) return candidate
  }

  return null
}
