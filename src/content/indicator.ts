// Small fixed on-page pill shown ONLY while auto-collection is running, so
// the user always sees that the extension is scrolling on their behalf and
// can stop it right where it's happening. Rendered inside a closed shadow
// root so page CSS can't restyle it and page scripts can't reach into it.

// Localized via chrome.i18n (_locales); falls back to English if the catalog
// key is missing so the indicator never renders blank.
function msg(key: string, fallback: string): string {
  try {
    return chrome.i18n.getMessage(key) || fallback
  } catch {
    return fallback
  }
}

let host: HTMLDivElement | null = null
let countEl: HTMLSpanElement | null = null

export function showIndicator(onStop: () => void): void {
  if (host) return

  host = document.createElement('div')
  // inset-inline-end rather than `right`: on an RTL page (Arabic Instagram) the
  // trailing corner is the left one, and a pill pinned to the physical right
  // there sits on the opposite side from every other trailing-edge control.
  host.style.cssText = 'position:fixed;bottom:16px;inset-inline-end:16px;z-index:2147483647;'
  const shadow = host.attachShadow({ mode: 'closed' })

  const pill = document.createElement('div')
  pill.style.cssText = [
    'display:flex;align-items:center;gap:8px',
    'background:#18181b;color:#fafafa',
    'font:12px/1.4 system-ui,sans-serif',
    'padding:8px 12px;border-radius:9999px',
    'box-shadow:0 4px 12px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12)',
  ].join(';')

  const dot = document.createElement('span')
  dot.style.cssText = 'width:8px;height:8px;border-radius:9999px;background:#22c55e;flex:none'
  // Keep the pulse subtle and cheap; respects prefers-reduced-motion.
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dot.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], { duration: 1500, iterations: Infinity })
  }

  const label = document.createElement('span')
  // Announced on insertion, so a screen reader reader is told the page has
  // started scrolling itself rather than finding out by the list moving. On
  // the label alone, never on the pill: the count beside it ticks continuously
  // and inside a live region would talk over everything else on the page.
  label.setAttribute('role', 'status')
  label.textContent = msg('indicatorCollecting', 'FollowLens is collecting')

  countEl = document.createElement('span')
  countEl.style.cssText = 'opacity:.7;font-variant-numeric:tabular-nums'
  countEl.textContent = '0'

  const stop = document.createElement('button')
  stop.type = 'button'
  stop.textContent = msg('indicatorStop', 'Stop')
  stop.setAttribute('aria-label', msg('indicatorStop', 'Stop'))
  stop.style.cssText = [
    'background:#3f3f46;color:#fafafa;border:0;border-radius:9999px',
    'font:600 12px/1 system-ui,sans-serif;padding:6px 10px;cursor:pointer',
  ].join(';')
  stop.addEventListener('click', onStop)

  pill.append(dot, label, countEl, stop)
  shadow.append(pill)
  document.documentElement.append(host)
}

export function updateIndicatorCount(followers: number, following: number): void {
  if (countEl) countEl.textContent = `${followers + following}`
}

export function hideIndicator(): void {
  host?.remove()
  host = null
  countEl = null
}
