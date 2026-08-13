# FollowLens — landing page

Static landing page for [FollowLens](../README.md), served by GitHub Pages from
this folder.

**Live site:** https://followlens.mtvrkan.com/

## Structure

```
index.html                    Landing page (14 sections)
tr/index.html                 GENERATED Turkish page — see below, never edit
privacy.html                  Privacy policy (mirrors ../PRIVACY.md, fully translated)
404.html                      Not-found page
assets/css/style.css          The whole design system — tokens, layout, components, motion
assets/js/i18n.js             English/Turkish swap + the Turkish dictionary
assets/js/motion.js           The looping set pieces
assets/js/main.js             Header, mobile sheet, back-to-top, scroll journey, reveals
assets/img/logo.svg           The brand mark, as served for the favicon
assets/img/og-image.png       The social card (see below)
CNAME                         Custom domain for GitHub Pages
```

No build step, no dependencies, no bundler. The only external request is the
Google Fonts stylesheet (Manrope for display, Inter for body — two families,
nothing else).

## The brand mark

`assets/img/logo.svg` is the mark, served for the favicon. The PNGs beside it —
`public/icon{16,48,128}.png` in the extension and `assets/img/icons/icon{32,128}.png`
here — are rendered from that SVG, but **the renderer and the rest of the brand
sources are not in this repository**. They are kept privately, along with the
Chrome Web Store tiles and the source of the social card.

This is a brand decision, not a technical one: the MIT licence covers the code,
not the name or the mark. If you are working on a fork, replace them with your
own — a fork shipping FollowLens' name and logo is the one thing the licence
does not permit. Never hand-edit the committed PNGs; they will be overwritten
the next time the mark is re-rendered.

The plate carries the extension's own `bg-gradient-brand`
(`hsl(258 90% 58%)` → `hsl(231 90% 60%)`), which is also what the in-app header
uses — so the toolbar icon, the app header and the site all resolve to one mark.

**The pages don't load that file.** Each carries the same geometry inline, as the
sprite's `#i-mark` symbol. An `<img src="logo.svg">` only paints if the host
sends `Content-Type: image/svg+xml`; several static servers (including the one
`npx http-server` picks by default here) send `application/octet-stream` instead,
and Chrome — which does not content-sniff SVG — renders a broken-image box. A
logo that depends on a response header is a logo that can vanish on a host you
don't control, so the mark is inlined and nothing about it is fetched.

The cost is four copies of ~8 lines of path data, in `logo.svg` and in the three
pages' sprites. Changing the mark means changing all four, then re-rendering the
PNGs. `logo.svg` remains what the favicon is served from (a favicon *is* served
with a correct type, since it's declared, not sniffed).

## Icons

One inline `<symbol>` sprite at the top of `index.html`, drawn on **Lucide's
grid** (24px box, 2px stroke, round caps and joins) because the extension's UI is
built on `lucide-react`. Inline rather than an icon font: no CDN request, nothing
to go stale, and no invisible-icon flash while a font downloads.

Adding one: define a `<symbol id="i-name">`, reference it with
`<svg class="i"><use href="#i-name"/></svg>`. The check below fails on both an
unresolved reference and a symbol nothing uses.

## Language

The markup ships **English** so crawlers and social unfurlers get real text
without running scripts. `i18n.js` swaps in Turkish at runtime: a Turkish
browser lands on Turkish automatically, and an explicit choice is remembered in
`localStorage`.

There are three ways to carry a key, because three different things need
translating:

| Attribute | Written with | Use for |
| --- | --- | --- |
| `data-i18n` | `textContent` | Almost everything. `<title>` works with it too, since `document.title` is that element's text. |
| `data-i18n-html` | `innerHTML` | Only strings that carry markup the sentence would lose. |
| `data-i18n-content` | the `content` attribute | `<meta>`. A description has no text node to write to. |

Everything but the `-html` form avoids `innerHTML`, so a translation can never
inject an element — and it also means **Turkish strings must be plain text, not
HTML entities** (`&`, not `&amp;`, or the entity renders literally).

The tab title and meta description follow the reader's language. The Open Graph
and Twitter tags deliberately **do not**: social unfurlers fetch the raw HTML and
never run scripts, so localising those client-side would change nothing for them
while letting the two sets disagree.

One string is computed rather than translated. The hero's notification claims the
previous scan was yesterday's, so `i18n.js` works out yesterday's date and
formats it with `Intl.DateTimeFormat` in whichever language is on screen. That
runs inside `apply()`, not once at load, so it follows the language switch.

Two consequences worth knowing:

- `textContent` **replaces every child node**, so a key must never sit on an
  element that also contains markup you need to keep. The result tabs learned
  this the hard way: `data-i18n` on the `<button>` deleted the count badge
  inside it. Put the key on an inner `<span>` instead.
- The footer credit has **no key on purpose**. It is a signature, and a
  signature reads the same in every language.

## Surfaces

A flat fill on a dark ground reads as a hole punched in the page, not as a card
sitting on it. What makes a dark surface look built is the pair of edges — a
bright hairline where light catches the top rim, a dark one where the bottom
falls away — plus a fill very slightly brighter at the top than the bottom.

That lighting model is four tokens (`--glass`, `--glass-strong`, `--edge`,
`--edge-strong`), and **every raised surface uses them**, so the page is lit from
one direction instead of card by card. The base colours are unchanged — still the
extension's own `--card` / `--bg-2`; only the light is added on top. When adding
a panel, reach for `background: var(--glass), <base>` and
`box-shadow: var(--edge), <cast shadow>` rather than inventing a fill.

The hero profile card goes further and is real glass: translucent with
`backdrop-filter`, so the purple bloom behind it actually bleeds through. That is
the only element on the page that blurs its backdrop — it is expensive, and it
earns it by being the first thing anyone sees.

Two details there are worth keeping if that card is ever rebuilt. Its Instagram
hairline is inset from both corners and masked to fade at each end; the
full-bleed 2px bar it replaced terminated in two hard stops against the rounded
corners, which is what made it read as a stray line rather than part of the card.
The rules between the three counts fade at their ends for the same reason, which
is why they are gradient backgrounds rather than `border`s.

## Motion

The rule this page is built on: **every animation demonstrates a product
behaviour.** The hero loses followers because that is the moment the product
exists for; the scanner streams rows because that is what Auto-Collect looks
like; the packets bounce because nothing leaves the device. An earlier build had
an ambient follower-graph canvas behind the whole page — it was removed, because
motion behind body text competes with reading instead of explaining anything.

There are two kinds, and they live in different files:

- **Scroll-scrubbed** (`main.js`) — the growth chart, the export deck, the
  quality meter, the spine. `main.js` writes a `--p` custom property from scroll
  position and CSS does the interpolation, so scrubbing back up rewinds them and
  the work stays off the main thread.
- **Looping** (`motion.js`) — the hero, the scanner, the result tabs, the word
  rotator. Each loop is owned by an IntersectionObserver and **stops when its
  section leaves the viewport**, so a page this animated costs nothing while you
  are reading a different part of it.

Exactly **one** scroll listener exists, in `main.js`; anything needing scroll
position subscribes to its rAF-throttled `frame()`. Adding a second listener per
animated element is what makes pages like this stutter.

Under `prefers-reduced-motion: reduce`, `motion.js` returns immediately, `--p` is
pinned to 1, and CSS leaves every piece in a composed resting state — nothing is
left mid-animation or invisible.

## Security

GitHub Pages cannot set response headers, so the policy ships as a `<meta>` tag
in each page's head. All three pages carry the same one:

```
default-src 'none'; script-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src https://fonts.gstatic.com; img-src 'self' data:;
connect-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests
```

`default-src 'none'` means anything not listed is refused, so the list above is
the page's complete network surface. `connect-src 'none'` is the load-bearing
one: the site claims nothing leaves your device, and this makes the browser
enforce that rather than leaving it as a sentence in the copy.

`script-src` has no `'unsafe-inline'` — every script is an external file, and the
JSON-LD block is data, not executable. `style-src` does need it: 38 elements
carry a `style` attribute (per-avatar hues, animation delays), which CSP counts
as inline styles. That is the one concession, and it is the cheap one.

`frame-ancestors`, `X-Frame-Options` and `nosniff` are **header-only** — a meta
tag cannot set them and browsers ignore them there. They are deliberately absent
rather than present and inert. Add them at the CDN if the site ever moves behind
one.

Test the policy over **HTTP, not `file://`** — `'self'` resolves differently for
a file URL, so a local pass proves nothing about the real host.

## The Turkish page

`tr/index.html` is **generated**. Never edit it: edit `index.html` or the
Turkish dictionary in `assets/js/i18n.js` and run

```bash
npm run build:tr
```

`npm run verify` runs it before the site checks, so a stale Turkish page shows
up as a difference in the working tree rather than in production.

**Why a second URL exists at all.** The language switch is client-side. Every
service that builds a share preview — WhatsApp, X, Telegram, LinkedIn, Slack —
fetches the raw HTML with a bot user-agent and never runs a script, so whatever
the reader picked, the card that got shared was always the English one. On a
static host the only way to serve Turkish Open Graph tags and a Turkish card is
an address that has them baked in.

The generator translates every `data-i18n*` node, rebuilds the FAQ structured
data from the now-Turkish questions, repoints the canonical, `og:url`,
`og:image` and the JSON-LD ids, and rewrites relative paths one directory
deeper. It writes the English original into `data-en` on each element it
touches; `i18n.js` leaves an existing `data-en` alone, which is what lets both
pages run the same unmodified script and keep a working in-page toggle.
`<html data-lang="tr">` is what tells that script the markup is already Turkish.

Both pages carry `hreflang` for `en`, `tr` and `x-default`, and both are in
`sitemap.xml`.

## The social card

`assets/img/og-image.png` (1200×630) is what `og:image` and `twitter:image`
point at on all three pages. It is rendered from an HTML source rather than
drawn by hand, so it can be regenerated after a copy or palette change — but
that source is a brand asset and is kept outside this repository, for the reason
given under [The brand mark](#the-brand-mark).

The committed PNG is the whole contract as far as the site is concerned: change
it and the pages pick it up, with no build step in between. Keep it at
1200 × 630 — both pages declare those dimensions in `og:image:width` /
`og:image:height`, and an unfurler that finds a different size will letterbox it.

`assets/img/og-image-tr.png` is the same card in Turkish, referenced by
`tr/index.html`. Its strings come from the same dictionary keys the page uses,
so the card and the page it links to make one promise rather than two.

## Local preview

```bash
npx http-server . -p 8080
# or
python -m http.server 8080
```

## Checking a change

There is no test runner here, so verify by measuring rather than eyeballing.
Four traps have caught real work on this page:

- **A narrow screenshot is a crop, not a phone view.** A headless window has a
  minimum width (485px on Windows). Load `index.html` in a fixed-width iframe
  instead and compare `documentElement.scrollWidth` against `clientWidth`; they
  must be equal at 375px. `.res-tabs` is expected to exceed it — it scrolls on
  purpose.
- **`--dump-dom` does not run rAF or IntersectionObserver.** Without frames,
  every scroll-driven class reads as "never applied" and every `.reveal` reads as
  still hidden — both are harness artifacts, not bugs. Pass `--screenshot` too,
  and trust the final frame over an intermediate DOM read.
- **CSS transitions do not advance under `--virtual-time-budget` either.**
  Adding `.in` to the reveals by hand is not enough: the class lands, the
  transition never runs, computed `opacity` stays `0`, and whole sections
  screenshot at part opacity — which looks exactly like a contrast bug that
  isn't there. Inject `.reveal{opacity:1!important;transform:none!important;
  transition:none!important}` to force the resting state instead of trying to
  trigger it.
- **Measure an element's rect only after the reveal has settled.** Measuring
  during the transition returns a rect ~16px low, so a crop taken from it lands
  *inside* the element and its top edge appears undrawn.
- **`scroll-behavior: smooth` breaks programmatic scrolling under virtual time**
  — the animation never completes, so the page screenshots at the top. Set
  `scrollBehavior = 'auto'` before `scrollTo`.
- **A downscaled screenshot loses 2px lines on a dark background.** The growth
  chart looks blank at 1/3 scale even when it drew correctly. Check
  `getComputedStyle` on the path instead of the image.

- **`node --check` does not prove a script runs.** `main.js` is one file of
  top-level IIFEs, so a *runtime* error anywhere in it stops every statement
  after it. A stale variable left behind by a refactor once threw near the
  middle of the file, which silently disabled the reveal wiring at the bottom
  and rendered the whole page blank below the header — while the syntax check
  passed and the screenshot harness, which force-shows revealed content, looked
  perfect. **Load the page and assert that something near the end of each script
  actually happened** (a `.reveal` carrying `.in`, `documentElement.lang` set).
- **A harness that forces the finished state cannot find a broken one.** When
  something is reported missing on the real site, reproduce it *without* the
  overrides and over HTTP before touching anything.
- **`--screenshot` always captures from the top of the document.** Scrolling
  first, by any means, does not move it — use the iframe harness when you need
  a scrolled view.

And check, every time:

- Every `data-i18n` key in the markup exists in the `TR` object, and nothing in
  `TR` is unused.
- Every `<use href="#…">` resolves to a defined `<symbol>`, and no symbol is
  dead weight.
- Every `href="#…"` resolves to an element that exists.
- The JSON-LD block still parses, **and its FAQ matches the visible one**. It
  drifted once — six entries against seven on the page, with pre-rewrite
  answers — which is exactly what Google penalises FAQ markup for. Regenerate it
  from the markup rather than editing it by hand.
- All three pages request the **same** font URL. `privacy.html` and `404.html`
  went on asking for a typeface the design had dropped, because the font link is
  duplicated per page and only `index.html` got updated.

## Deploying

GitHub Pages → **Settings → Pages → Source: `main` branch, `/docs` folder**.
`CNAME` is committed, so the custom domain survives redeploys; the DNS side
needs a `CNAME` record for `followlens` pointing at `mtvrkan.github.io`.
