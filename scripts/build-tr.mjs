/**
 * Generates docs/tr/index.html from docs/index.html and the Turkish dictionary
 * in docs/assets/js/i18n.js.
 *
 * WHY A SECOND URL AT ALL. The site picks its language at runtime, in JS. Every
 * unfurler that builds a share preview — WhatsApp, X, Telegram, LinkedIn, Slack
 * — fetches the raw HTML with a bot user-agent and never runs a script, so a
 * client-side switch cannot reach them: whatever the reader picked, the card
 * that gets shared is always the English one. On a static host the only way to
 * serve Turkish Open Graph tags and a Turkish card is a second URL that has
 * them baked in. That is all this exists for.
 *
 * WHY GENERATED RATHER THAN COPIED. A hand-maintained second copy of a
 * 900-line page drifts from the first the day after it is made, and the drift
 * is invisible to whoever is not reading Turkish. Here the English page stays
 * the only thing anyone edits.
 *
 * THE CONTRACT WITH i18n.js. The generated page carries Turkish in the markup
 * *and* the English original in `data-en` on the same element. i18n.js writes
 * `data-en` itself on the English page but leaves an existing one alone, so
 * both pages run the same unmodified script and the in-page language toggle
 * keeps working on each. `<html data-lang="tr">` is what tells it which
 * language the markup is already in.
 *
 *   node scripts/build-tr.mjs
 *
 * Run it after any edit to index.html or to the dictionary. `npm run verify`
 * runs it, then checks the result.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = path.join(ROOT, 'docs')
const SRC = path.join(DOCS, 'index.html')
const OUT_DIR = path.join(DOCS, 'tr')
const OUT = path.join(OUT_DIR, 'index.html')

const SITE = 'https://followlens.mtvrkan.com'

// ── The dictionary ───────────────────────────────────────────────────────────
// Lifted out of i18n.js as a literal rather than imported: the file is an IIFE
// written for a browser with no module boundary, and adding an export to it
// only to satisfy this script would put build machinery into the page every
// visitor downloads.
function readDictionary() {
  const js = readFileSync(path.join(DOCS, 'assets/js/i18n.js'), 'utf8')
  const start = js.indexOf('var TR = {')
  if (start === -1) throw new Error('i18n.js: "var TR = {" not found — did the dictionary move?')
  const open = js.indexOf('{', start)
  // Brace matching rather than a regex: the values contain braces and quotes,
  // and a lazy match stops at the first one inside a translation.
  let depth = 0
  let end = -1
  let inStr = null
  for (let i = open; i < js.length; i++) {
    const c = js[i]
    if (inStr) {
      if (c === '\\') i++
      else if (c === inStr) inStr = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') inStr = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) { end = i + 1; break }
  }
  if (end === -1) throw new Error('i18n.js: the TR object is not closed')
  const dict = new Function(`return ${js.slice(open, end)}`)()
  const count = Object.keys(dict).length
  if (count < 100) throw new Error(`i18n.js: only ${count} keys parsed — that cannot be right`)
  return dict
}

// ── Build ────────────────────────────────────────────────────────────────────
const TR = readDictionary()
const dom = new JSDOM(readFileSync(SRC, 'utf8'))
const { document: doc } = dom.window

const missing = []

for (const el of doc.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-content]')) {
  const mode = el.dataset.i18nHtml != null ? 'html' : el.dataset.i18nContent != null ? 'content' : 'text'
  const key = el.dataset.i18nHtml ?? el.dataset.i18nContent ?? el.dataset.i18n
  const english = mode === 'html' ? el.innerHTML : mode === 'content' ? el.getAttribute('content') : el.textContent

  const turkish = TR[key]
  if (turkish == null) { missing.push(key); continue }

  // The English original travels with the element so the toggle still has
  // something to switch back to. i18n.js reads it and does not overwrite it.
  el.dataset.en = english
  if (mode === 'html') el.innerHTML = turkish
  else if (mode === 'content') el.setAttribute('content', turkish)
  else el.textContent = turkish
}

if (missing.length) {
  console.error(`No Turkish for: ${missing.join(', ')}`)
  process.exit(1)
}

// ── Head: the part that only a second URL can carry ──────────────────────────
const html = doc.documentElement
html.setAttribute('lang', 'tr')
html.dataset.lang = 'tr'

const set = (sel, attr, value) => {
  const el = doc.querySelector(sel)
  if (!el) throw new Error(`index.html: ${sel} is gone — this script assumed it exists`)
  el.setAttribute(attr, value)
}

set('link[rel="canonical"]', 'href', `${SITE}/tr/`)
set('meta[property="og:url"]', 'content', `${SITE}/tr/`)
set('meta[property="og:locale"]', 'content', 'tr_TR')
set('meta[property="og:locale:alternate"]', 'content', 'en_US')
set('meta[property="og:image"]', 'content', `${SITE}/assets/img/og-image-tr.png`)
set('meta[name="twitter:image"]', 'content', `${SITE}/assets/img/og-image-tr.png`)

// The Open Graph and Twitter text, which on the English page is deliberately
// static because no script reaches an unfurler. Here it is static *and*
// Turkish, which is the whole point of the page.
set('meta[property="og:title"]', 'content', TR['meta.title'])
set('meta[property="og:description"]', 'content', TR['og.desc'] ?? TR['meta.desc'])
set('meta[property="og:image:alt"]', 'content', TR['og.imageAlt'] ?? TR['meta.title'])
set('meta[name="twitter:title"]', 'content', TR['meta.title'])
set('meta[name="twitter:description"]', 'content', TR['og.desc'] ?? TR['meta.desc'])
set('meta[name="twitter:image:alt"]', 'content', TR['og.imageAlt'] ?? TR['meta.title'])

// ── Structured data ──────────────────────────────────────────────────────────
// The JSON-LD is static markup, so translating the visible page leaves it
// describing a page that no longer exists — English answers under Turkish
// questions is exactly the mismatch FAQ markup gets penalised for. The FAQ node
// is rebuilt from the Turkish FAQ now on the page, which is also how the
// English one is kept honest (check-site.mjs compares the two).
const ldNode = doc.querySelector('script[type="application/ld+json"]')
if (ldNode) {
  const ld = JSON.parse(ldNode.textContent)
  const graph = ld['@graph'] ?? []

  const faqNode = graph.find((n) => n['@type'] === 'FAQPage')
  if (faqNode) {
    faqNode.mainEntity = [...doc.querySelectorAll('.faq details')].map((d) => ({
      '@type': 'Question',
      name: d.querySelector('summary span').textContent.trim(),
      acceptedAnswer: { '@type': 'Answer', text: d.querySelector('p').textContent.trim() },
    }))
    if (!faqNode.mainEntity.length) throw new Error('no .faq details found — the FAQ markup moved')
  }

  // Each node's own id and url stay pointed at the Turkish URL, so the two
  // pages describe themselves rather than both claiming to be the English one.
  for (const node of graph) {
    for (const field of ['@id', 'url']) {
      if (typeof node[field] === 'string' && node[field].startsWith(`${SITE}/`) && !node[field].startsWith(`${SITE}/tr/`)) {
        node[field] = node[field].replace(`${SITE}/`, `${SITE}/tr/`)
      }
    }
  }

  const app = graph.find((n) => n['@type'] === 'SoftwareApplication')
  if (app) {
    if (TR['ld.appDesc']) app.description = TR['ld.appDesc']
    // downloadUrl is the store listing, not a page on this site — the rewrite
    // above must not have touched it, and this asserts that it did not.
    if (app.downloadUrl && app.downloadUrl.includes('followlens.mtvrkan.com')) {
      throw new Error('downloadUrl was rewritten — it should point at the Chrome Web Store')
    }
  }

  ldNode.textContent = JSON.stringify(ld, null, 2)
}

// ── Relative paths, one directory deeper ─────────────────────────────────────
for (const el of doc.querySelectorAll('[src], [href]')) {
  for (const attr of ['src', 'href']) {
    const v = el.getAttribute(attr)
    if (!v) continue
    // Anchors, absolute URLs and data: URIs are already right; everything else
    // in this page is a path relative to docs/.
    if (/^(#|https?:|mailto:|data:|\/)/.test(v)) continue
    el.setAttribute(attr, `../${v}`)
  }
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(
  OUT,
  '<!DOCTYPE html>\n' +
    '<!-- GENERATED by scripts/build-tr.mjs — do not edit. Edit docs/index.html\n' +
    '     or the Turkish dictionary in docs/assets/js/i18n.js and re-run it. -->\n' +
    doc.documentElement.outerHTML +
    '\n',
  'utf8',
)

console.log(`docs/tr/index.html written — ${Object.keys(TR).length} translations applied`)
