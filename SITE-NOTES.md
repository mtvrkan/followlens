# SITE-NOTES.md — why the landing page is built the way it is

Everything in `docs/` is served to the public byte for byte, and view-source shows
whatever is in it. So the reasoning that used to live in comments inside those
files lives here instead — nothing was thrown away, it just stopped shipping.

Anchors are file + selector/function. When you change one of those, change the
note; a rationale that no longer matches the code is worse than none.

Related: [`DECISIONS.md`](DECISIONS.md) covers the extension, this file covers the
site. [`docs/README.md`](docs/README.md) is the map of what is in `docs/` and how
to build it.

---

## 1. The three rules the page is built on

**1. Motion explains.** Every animation demonstrates a real product behaviour —
the hero loses followers, the scanner collects, the chart draws the history.
Nothing moves for texture alone. The page reads as a journey down through the
product, so most set pieces are driven by scroll position (`--p`, 0..1, written
by `main.js`) rather than fired on entry: scrubbing back up rewinds them.

**2. It borrows the extension's own visual language.** The surface ramp is lifted
straight from `src/styles/globals.css`'s `.dark` block — `--surface` is literally
the extension's `--card`. The brand gradient is its `bg-gradient-brand`. Radii
descend from its `--radius: 0.5rem`. Tone follows its rule (see
`ui/stat-card.tsx`): only destructive and warning surfaces get tinted, everything
else is neutral. The site should look like the product, not like a template the
product was dropped into.

**3. Platform colour is never decoration.** Instagram's gradient appears only
where the page is literally talking about Instagram; GitHub gets neutral white.
Neither is used to liven up a panel.

---

## 2. Head, indexing and social cards

**CSP** — `index.html`, the `Content-Security-Policy` meta. Every source is
`'self'` or `'none'` now that the typefaces are served from this origin: the
policy no longer names a single outside host, which is the strongest possible
form of the claim the page makes about your data.

**Title and description follow the reader; Open Graph does not** — `<title>` and
`meta[name=description]` carry `data-i18n`; the OG and Twitter tags deliberately
do not. Social unfurlers fetch the raw HTML and never run scripts, so localising
those client-side would change nothing for them while making the two sets
disagree.

**The description is held under ~160 characters.** Google truncates a snippet at
roughly that length, and this one ran to 268 — the last third, which carried the
differentiator, was never being shown. The long form of the same claim lives in
the `SoftwareApplication` description in the JSON-LD, where length costs nothing.

**Why a second URL for Turkish** — `link[hreflang]`. The Turkish page is
generated from `index.html` by `scripts/build-tr.mjs`. It is a separate URL
because an unfurler never runs the language switch: it reads the raw HTML, so
Turkish Open Graph tags and a Turkish card can only live at an address that has
them baked in.

**The `.ico` is first and root-absolute on purpose** — `link[rel=icon]`. Google
Search fetches a site's favicon with its own crawler, wants a square that is a
multiple of 48px, and falls back to `/favicon.ico` when a page declares nothing
it can use — the result was a generic globe against 32px PNGs and an SVG. It is
rendered from `logo.svg` by `brand-sources/render-icons.cjs`, same as the rest.

**`apple-touch-icon` is 128, not 180.** The file behind it is 128px and iOS
scales it either way. The attribute is a description of the image, not a request
for one.

**Font preloads** — only the two faces the first screen actually paints with,
fetched in parallel with the stylesheet instead of waiting for it to be parsed.
The latin-ext pair is deliberately not preloaded: an English reader never needs
it, and a Turkish one picks it up a moment later. `crossorigin` is required on
font preloads even same-origin, or the preload is discarded and the file is
fetched twice.

**`privacy.html` is canonical at `/privacy`, without the extension.** GitHub
Pages answers both `/privacy` and `/privacy.html` with 200, so the page has two
URLs and only the one named in the canonical is the one Google indexes and
prints. It used to name the `.html`.

**The store id appears in exactly two places** — the primary button in the closer,
and `downloadUrl` in the JSON-LD at the top of `index.html`. If the id ever
changes, those are the only two. The listing is live, so the button resolves;
the "Or install from source" note beneath it stays anyway, because the project is
open source and building it yourself is a supported way in, not a stopgap. That
link must keep working.

**Only the browsers actually tested are named** — `end.noteA` says Chrome and
Brave. The rest of Chromium will very likely run it, but "very likely" is not a
claim a landing page gets to make; they go on the list once they have been
checked.

---

## 3. Typefaces

`style.css`, the `@font-face` block.

Served from this origin, not from `fonts.googleapis.com`. The page's whole
argument is that nothing about you is sent anywhere, and a Google Fonts `<link>`
sends every visitor's IP and User-Agent to Google before the first paint — on the
very page that says it doesn't. Two files removed the last third-party request
the site made; `connect-src 'none'` and `font-src 'self'` in the CSP now describe
a page with no outside dependencies at all.

Variable fonts, one file per subset rather than one per weight: Inter is used at
400/500/600 and Manrope at 400/600/700/800, which as static faces would be seven
downloads. The unicode-ranges are Google's own, so a reader in English never
fetches latin-ext — but a Turkish one does, and needs to: ğ, ş, İ live there.
Only ı (U+0131) is in the base latin range.

`font-display: swap` — the text is readable immediately in the fallback and
reflows once; `block` would hide the headline while the file loads, which is both
worse to look at and worse for CLS.

**Two families, and only two** (`--display` / `--body`). Inter carries the
interface, Manrope the headlines, and hierarchy comes from weight and size rather
than from a third typeface. An italic serif accent lived here for a while: at
headline size it read as an invitation rather than as software, and once the one
remaining phrase using it was rewritten as a plain sentence, a whole font was
being downloaded for nothing.

`.mono` is the data/label voice: tabular Inter with wide tracking rather than a
fourth typeface — it reads as instrumentation without another font on the page.

---

## 4. Tokens and the lighting model

**Surfaces** (`--bg`, `--surface`) are the extension's own dark ramp. `--bg` sits
one step below its background so the page has somewhere darker to recede to;
`--surface` is its `--card` value unchanged, so a card here and a card in the
dashboard are the same colour.

**Brand** (`--brand`, `--brand-lit`) are the extension's `bg-gradient-brand`
endpoints, plus the lighter dark-theme primary for anything that has to stay
legible as text.

**Instagram's ramp** (`--ig`) is used only when naming Instagram. It is a radial
thrown from just off the bottom-left corner, which is what makes it read as
Instagram at a glance. A conic was used here for a while and it was a mistake: on
a 21px dot the visible face landed almost entirely in the yellow-to-orange arc,
so the badge read as a generic orange blob with none of the magenta the mark is
actually known for. `--ig-ring` stays conic, because the avatar ring spins and a
radial rotating about its own centre is a still image.

**Glass** (`--glass`, `--edge`, and friends). Every raised surface on this page is
lit from the same direction. A flat fill on a dark ground reads as a hole punched
in the page; what makes a dark card look built rather than drawn is the pair of
edges — a bright hairline where light catches the top rim, a dark one where the
bottom falls away — plus a fill that is very slightly brighter at the top. These
four tokens are that lighting model, and everything raised uses them, so the whole
page is lit consistently instead of card by card. Values are deliberately low:
5.5% white over `--surface` is roughly one step up the extension's own ramp, not a
new colour. `--edge` is top rim lit, bottom rim in shadow — two insets, always in
that order.

**Radii** descend from the extension's `--radius: 0.5rem`. Nothing here is a
pill-card.

**`overflow-x: hidden` on the page** — the journey spine and the section glows are
absolutely positioned against the page, so a stray horizontal scrollbar would be a
real bug. `#main` is `position: relative` because the spine is positioned against
the whole of `<main>`.

**`.grain`** is film grain over the whole page. Cheap, fixed, and it stops the
large flat dark areas from banding on 8-bit panels.

---

## 5. The mark and the icon sprite

**`docs/assets/img/logo.svg`** — a lens with two accounts inside it: one solid,
one already fading out. The product in one glyph: you are looking at your circle,
and someone in it is on the way out. The plate carries the extension's own brand
gradient (Tailwind `bg-gradient-brand`, hsl(258 90% 58%) → hsl(231 90% 60%) at
135deg), so the toolbar icon, the in-app header and this site all resolve to the
same mark. `public/icon{16,48,128}.png` are rendered from this file — regenerate
them together, never one alone.

**The pages do not load `logo.svg` for their on-page logo.** They carry the same
geometry inline as the sprite's `#i-mark` symbol, because a host that serves
`.svg` as `application/octet-stream` (some static servers do) makes Chrome refuse
to paint an `<img>`, and a logo that depends on a Content-Type header is a logo
that can vanish. The inline gradient is kept in sync with `logo.svg` by hand;
`logo.svg` is still the source the PNGs render from.

**The sprite** is drawn on Lucide's grid (24px box, 2px stroke, round caps and
joins), because the extension's own UI is built on `lucide-react` — the site and
the product are drawn by the same hand. Inline rather than an icon font: no CDN
request, nothing to go stale, no invisible-icon flash on load.

**`#i-verified` is Instagram's seal, not a bare tick.** The scalloped blue badge
is the thing people actually recognise; a plain check beside a handle reads as a
list marker instead. Twelve lobes on a 24px grid; the seal is stroked in its own
fill colour with round joins, which rounds the points the way the real mark does
without a path full of arcs. The blue is written in rather than tokenised: it is
Instagram's, not the site's, and a badge that turns black when a stylesheet is
slow is not a badge. In `.igc-id b .i-verified` it only needs sizing, a hair
larger than a bare tick would be, because its check sits inside a border.

**`.brand`** — the drop-shadow gives the plate the same lift the glass surfaces
have, so it sits on the page instead of on top of it.

---

## 6. Page furniture

**Header** (`.hdr`) — full width and transparent at the top of the page; on the
first scroll it contracts into a centred floating island with its own blur and
border. One element, one class: the width and radius do the work.

- The compact island's padding is near-symmetric. With the install button gone the
  language pill is the last element, and it sits inside a fully-rounded island
  where the edge bulges furthest out at the vertical centre — the 8px that suited
  a button ending in a square-ish corner reads pinched against the curve.
- Its `max-width` is wide enough for the longest translated nav set. Turkish
  labels run about a third longer than the English ones, and at 760px they wrapped
  to two lines the moment the island contracted.
- `.hnav a.here` is the active section, tracked by `main.js` as you scroll — the
  header doubles as a position readout for the journey.

**Back to top** (`.totop`) — the ring around it is the same scroll fraction the
header hairline reports, so the control tells you where you are as well as where
it will take you.

**The journey spine** (`.spine`) — a hairline runs down the page through every
section index, filling as you descend. It is the page's own progress bar, read at
reading distance instead of at the top edge. It is faded at both ends rather than
butting into the header and the footer: a rule that starts at y=0 reads as a stray
border, one that fades in reads as a margin the page is hung from. The mask fades
the progress fill with it.

**Bands** (`.band`) use `overflow-x: clip`, not `hidden`. The ghost numeral is
anchored past the right edge on purpose, and on a phone that put nine pixels of
horizontal scroll on the document. `clip` cuts it without turning the band into a
scroll container, which `hidden` would — and a scroll container here would break
the sticky header's relationship to the page and the anchor scrolling.

**`.ghost`** is a vast numeral behind each band, anchored to the right edge. Purely
editorial furniture, and it is what stops fourteen dark sections from reading as
one undifferentiated scroll. **`.aura`** is soft brand light behind a band,
positioned per-section. **`.idx`** is the section index; its dot sits on the spine.

**`h2 + p, h2 + .lede`** is deliberately not scoped to `.head`: the two-column
sections put their heading straight into a bare column, and every one of them
needs the same air under the h2.

**Buttons** — `.btn-primary::after` is a light sweep on hover, the one purely
decorative flourish on the page, and it costs a pseudo-element.

**`.grad`** — one gradient headline per page, in the hero. Repeating it in every
section is the tell of a template. The ramp starts and ends on the same colour on
purpose: the animation slides the background a full tile width, and a gradient
that ended on a different colour would show a hard seam every time it wrapped.

---

## 7. Reveal and stagger

**`.reveal`** fades a whole block in as one object, which is right for a heading or
a single panel but makes a four-card grid land like a slab — the sections built
that way were the ones that read as "no animation" while everything around them
moved.

**`.reveal.stag`** is the fix: the container stops fading (it has nothing of its
own to show) and its children arrive in sequence instead, so scrolling assembles
the section rather than switching it on. 60ms apart — below about 40 the sequence
stops reading as one, above about 90 the last item feels late. Capped at eight,
after which everything remaining shares the final delay: a seven-item FAQ should
not take a second and a half to finish.

**`.cmp-wrap.reveal`** is the same idea one row at a time, opacity only: a
transform on a `<tr>` is not reliably composited across browsers.

---

## 8. Section by section

### Hero

The hero owns the first screen outright. Sized by its padding alone it came up
short of the viewport on a wide, shallow window, so the next band's index line
("01 · THE PROBLEM") sat in the last 30px of the fold — the one thing in view that
says the page has not finished introducing itself. A minimum of one viewport
pushes it below the fold; the content then centres inside that height instead of
hanging from the top padding.

`svh`, not `vh`: on mobile the address bar is showing when the page first paints,
and `vh` measures the taller viewport it is not using yet, which puts a slice of
the next band back on screen. The `vh` line above it is the fallback for browsers
without the newer units. The padding stays asymmetric — more above than below —
because the header floats over the top of it, and centring inside a symmetric box
would tuck the platform pills under it.

**The headline changes voice halfway through**: the fact at full weight, the
answer at 400. Two heavy sentences stacked read as a slab, and the weight drop is
what gives the second one its emphasis — the gradient then lands on the lighter of
the two shapes, where it shows through the letterforms instead of being smothered
by them. This was an italic serif for one round and it was wrong: at 66px an
Instrument Serif italic reads as an invitation, not as software. The contrast is
worth having, but it belongs inside the one grotesk. Light weights need their
tracking opened back up or they look squeezed.

**`.hero .micro`** — three promises, as chips rather than a run of ticked text.
Loose inline text under a CTA reads as fine print, the thing you skip, and these
are the three facts most likely to decide whether someone installs; given edges
they read as claims. Quieter than the platform pills above them on purpose: no
filled dot, smaller, lower contrast, so the hero still has one clear hierarchy
rather than two competing rows of pills. The selector is direct-children-only —
each chip wraps a second `<span>` carrying the translation key, and a descendant
selector would style the label as a chip too, giving you a pill inside a pill.

**`.plats`** — GitHub sits beside Instagram from the first screen. `.plat::before`
draws the border as a gradient rather than a flat line: brighter where the top rim
is lit, fading to nothing at the bottom, matching how `--edge` lights the fill. A
pill this small can't carry a real bevel, so the border does the work; it is
painted as a masked ring rather than `border-image`, which can't do rounded
corners on its own. Both marks opt out of the pill's text colour — `.gh` sets a
dark glyph for its white plate, and `.ig` was left inheriting `--dim`, which over
the Instagram gradient reads as a smudge rather than a mark, worst where the
gradient is lightest. White, with a hairline shadow so the strokes still separate
from the yellow corner.

**The profile card** (`.igc`) is a convincing stand-in for a real profile header:
the ring, the three counts, and the people peeling out of it. It is the same card
the extension itself draws, which is why it uses `--surface`. Real glass, not a
flat panel: the fill is translucent and the backdrop is blurred, so the purple
bloom behind it (`.pcard-glow`) and the hero's aura bleed through and move with
the card instead of being hidden by it. Three edges give it thickness — a dark
ring outside the border to cut it out of the page, a lit rim inside the top, a
shadow inside the bottom.

Without `backdrop-filter` the fill is simply 60% opaque over the aura, and body
text loses contrast against the bright part of the bloom; the `@supports` fallback
drops to the opaque surface. No glass, but nothing unreadable.

`.igc::before` — Instagram's ramp still names the card, but as a lit filament on
the top rim rather than a bar ruled across it: inset from both corners and faded
out at each end, so it reads as light catching an edge. The full-bleed 2px version
it replaces terminated in two hard stops at the rounded corners, which is what
made it look like a stray line. `.igc::after` is a slow specular sweep across the
glass — the one thing on this card that is pure surface rather than product
behaviour, and the reason it is this quiet: 14s, 6% white, and it stops with the
rest of the hero when it scrolls away. `.igc-stats` rules fade out at their ends
for the same reason as the filament, which is why they are backgrounds rather than
borders.

**The verdict banner** (`.verdict`) is the payoff of the hero loop, shaped as what
it actually is: a notification. Heavily rounded, translucent, blurring whatever it
lands on — the same language an OS uses for a banner, which is why it reads as
news arriving rather than as another panel in the layout. It drops in from above
with a single overshoot, not a fade-up, which would read as page content revealing
itself. `.on` is removed and re-added by `motion.js` each cycle with a reflow
between, so it replays. The mark pings once as it lands with a ring flaring behind
it — the arrival, not a loop.

The "compared with your scan from …" line is split around a `<time>` so the date
can be filled in at runtime. A single `data-i18n` string could not hold it: the
key is written with `textContent`, which would replace the element.

### Cards, generally

A flat fill on a dark ground reads as a hole in the page. Every card gets the same
lighting as the hero's glass — top-lit fill, bright rim above, shadow rim below,
and enough cast shadow to sit off the background — so the whole page is lit from
one direction instead of card by card. The base colour is still the extension's
`--card`, unchanged; only the light is new. `.card-warn` mirrors the extension's
tone rule: only the counts worth worrying about get a tinted surface, everything
else stays neutral.

### 01 · The problem

`.versus` uses the same construction as the hero card: a bloom laid down first,
then panels translucent enough to let it through. These two are the argument the
whole page rests on, so they get the page's most expensive surface rather than the
flat one every other section uses. `.vs-after` restates `.card-hi`'s brand-tinted
fill as glass, because `.vs-card` above it would otherwise overwrite it (same
specificity, later in the file).

### 03 · Who's watching

The section that says out loud what people actually use this for: pointing it at
somebody else's public profile. Editorial and centred, so it reads as an aside
rather than another feature panel.

Every claim here is bounded by what the extension really does. It scans whatever
profile is open in your own session, so the line is not public-vs-private but
openable-vs-not: a private account you already follow shows you its followers, so
it scans; one that will not open for you will not open for the extension either.
Saying "public only" here was both wrong and needlessly narrow.

**The rotator** (`.rotator`) is a block, so the word that changes gets the first
line to itself. Inline, it shared that line with whatever fitted beside it, and
because the box reserves the width of the longest word, a short one left a hole in
the middle of the headline that read as a rendering fault. It is centred by auto
margins rather than by the inherited `text-align`, since the box is only as wide
as `--w` and the transition animates that width — the word stays on the centre
line while it grows. The word inside is centred with a transform, **not** with
`left:0;right:0`: anchoring both edges makes the word's width come from the box,
and the box's width is measured from the word, so the two define each other and
everything resolves to zero.

The rotating word is the subject of the sentence, so with it hidden from assistive
technology the rest is a question with nobody in it. One static sentence naming
all five is read instead (`stalk.srLine`), and every visible part is hidden from
the screen reader.

**`.watch`** — `padding: 0` is load-bearing, not tidiness: a `<ul>` carries a 40px
inline-start padding by default, so this row sat 40px right of the worked example
beneath it and of every other block in the section. Every other list on the page
already resets it; this one was the exception.

**`.probe`** is the worked example: one profile, two scans, a diff between them.
Its top margin is 38, not the 22 it used to carry — the row above lost the `<ul>`
bottom margin that was silently making up the difference when its padding was
reset. `.probe-note` is pinned to the bottom of its card rather than trailing its
own content: the two cards hold a different number of rows, so left to sit 16px
under the last one the two captions landed on different lines and the pair stopped
reading as a before/after. `auto` for the gap, padding for the minimum.

### 04 · How

`.steps` resets the list padding for the same reason: an `<ol>` keeps a 40px
`padding-left` by default, and the gap-as-border trick paints the page background
through it as a dark stripe.

### 06 · The app

`.win` is a stylised extension window: chrome, sidebar, and a body that swaps.
`.win-side` is the sidebar the extension actually has — two pickers and the saved
scans. It stays put while the main area switches, which is how the app behaves; an
earlier version of this mock invented a four-item nav that does not exist anywhere
in the product. `.win-tabs` are the two real tabs, plus the sub-tabs that sit
inside Detailed Analysis.

### 07 · Scan quality

`.qmeter` fills to `calc(var(--p) * 99.77%)` — 1281 of 1284, deliberately never
full, which is the whole point of the section: the panel shows the gap rather than
rounding it away.

### 08 · Analytics

`.chart .line` is drawn by scroll position rather than a one-shot animation:
`stroke-dashoffset` is set from `--p`, so scrubbing back up un-draws it. Each dot
lands as the drawn line reaches it — a threshold on the same `--p`, so no JS is
needed to sequence them and scrubbing back up removes them in the right order.

### 09 · Export

`--q` is `clamp(0, calc((var(--p) - var(--lag)) * 1.7), 1)`: `--p` is the section's
scroll fraction and `--lag` staggers the four cards, so the deck riffles open
instead of every card moving as one block. The floor on opacity keeps the resting
state looking like a stacked deck rather than a half-rendered smudge.

### 10 · Privacy

`.checks` — four promises, as cards. Ruled rows read as fine print, and these are
the four sentences the whole section exists to make.

`.priv-more` is prose, then a short link — not one underlined sentence spanning
the column, which read as a rule drawn under the section rather than as something
to click. The label carries the accent so it is findable without the underline
doing all the work.

`.vault` is the device, and the boundary nothing crosses. The packets used to fly
off into empty space, which made them read as a stray red dot rather than as
something being turned back — the ring is what gives them a wall to hit.

### 11 · Why not the others

`.cmp` should read as a comparison, not as a spreadsheet. The previous version
tinted every row, which put a muddy stripe across the whole table and highlighted
nothing — the eye had no column to land on. The tint now runs down the FollowLens
column instead, as one continuous band from the header to the last row, so the
answer is a shape rather than something you assemble cell by cell.
`border-collapse` must be `separate` for that band to take rounded ends, which is
why the row rules are inset shadows rather than borders (collapse would merge
them). The header cell caps the band and the last row closes it.

`.cmp .yes .i / .no .i` are chips rather than loose glyphs, and the verdict colour
lives in the chip so the answer text stays readable instead of being tinted red or
green. `.cmp-lbl` is hidden on desktop — the `<thead>` names the columns there, so
the per-cell labels only earn their place once the table stacks.

### 12 · FAQ

Cards rather than hairline rows. Everything else raised on this page is a lit
card, and a bare ruled list read like a table of contents dropped into the middle
of the design. The open state borrows the brand tint the rest of the page uses for
"this is the one you're looking at". `.chev` sits in its own chip, so the row has a
target rather than a loose glyph floating at the end of a long line.

### Closer and footer

`.closer .micro` is held to the width of the lede above it. Left to run the full
column, one sentence of fine print stretched across 1100px and read as a caption
bar.

There is no footer nav on any page — the link row went from the home page first
and from the privacy page with it. A footer is a signature line, not a second
navigation.

**The credit line is deliberately never translated**, on all three pages: it is a
signature, and a signature reads the same in every language. That is why it
carries no `data-i18n` key. On `privacy.html` the contact address also sits
outside the translated span, so it reads last in both languages and no translation
can accidentally rewrite it.

### Document pages (privacy, 404)

On the 404 the numeral is the headline and the sentence under it is a caption. At
the page's normal `h1` size it ran wider than everything else on the page and
competed with the 404 instead of explaining it. `.nf-aura` is the hero's bloom,
dimmer: this page is a wrong turn, not a landing — but a wrong address should
still land somewhere that looks like the product rather than on a bare page.

---

## 9. Responsive

**Below 1300px** the spine goes. It is anchored to the page gutter, and once the
layout is narrower than the page width it has no room to sit outside the text.

**`minmax(0, 1fr)`, never a bare `1fr`.** A grid column's implicit minimum is
`min-content`, so one bare `1fr` column containing anything that will not shrink —
a stat row, a mock window, a nowrap label — pushes the column past the viewport
and takes the whole page with it. Every stacking rule was declared `minmax(0, …)`
at full width for exactly that reason, and the stacking rule quietly threw it
away: below 1040px the page scrolled sideways and everything past ~390px was
simply cut off.

**Below 1040px the nav goes and nothing replaces it.** There is no menu button:
the page is one scroll from top to bottom, every section leads into the next, and
a full-screen panel duplicating that order was a second way to do the only thing
the page already does. The language switch takes the space it used to occupy — the
one header control that has no equivalent further down the page. Only the island's
width is overridden, never its radius: a phone header that squared off where the
desktop one is a pill read as a different component rather than as the same one,
narrower.

**`.win-side` stacks, it does not lie on its side.** Turning the sidebar into a
horizontal scroller to save height made every child stretch to the tallest of them
— two pickers the height of the whole strip — and pushed the scan list off the
right edge, where a scroller inside a static mock reads as the mock being broken.
It keeps the real sidebar's own order, just wider than it is tall; only the scans,
which are short and repetitive, run across.

**`.fan`** cannot fan sideways on a phone, so it stacks into a 2×2.

**The comparison table stacks into cards.** Three columns cannot survive 390px —
the third gets clipped and the table reads as broken rather than as scrollable —
so each row becomes its own card with the column name moved inside the cell. The
caption needs `display: block` too: a table-caption whose table has been switched
to block has no table to belong to, so the browser wraps it in an anonymous table
box that shrink-wraps, and the sentence ended up stacked one or two words per line
down a narrow column beside the cards. And `td.col-us` drops its tint: stacked,
the two answers sit one above the other inside a single card, so a full-width tint
on one of them would read as a second card rather than as a highlighted column —
the label carries the emphasis instead.

**The footer mark is hidden on phones.** The mark and the wordmark are already the
first thing on the page, 4000px up. Repeating them here leaves the signature
crammed against the edge; the credit line is the part that is actually saying
something.

---

## 10. Reduced motion

Everything that moves is either decorative or has its resting state defined in the
`prefers-reduced-motion` block, so the page stays complete and readable with
motion switched off.

Staggered children need their resting state spelled out too: the stagger delays
are `transition-delay`, which the duration reset does not cancel, so without that
rule a reduced-motion reader would watch items appear one by one anyway — just
instantly, which is worse than either option.

`motion.js` does nothing at all under reduced motion, and `main.js` treats the
finished state as the resting state for every scrubbed section.

---

## 11. `main.js` — page chrome and the scroll journey

Everything here is progressive: with this file missing the page is still a
complete, readable document — the header just stops contracting, the spine stops
filling, and the reveals never hide in the first place (CSS only hides `.reveal`
elements once this file has confirmed it can un-hide them).

**One rAF-throttled scroll handler drives the lot.** Registering a second listener
per animated element is what makes pages like this stutter, so anything that needs
scroll position subscribes to `frame` instead. Subscribers run once per animation
frame in which the page moved.

**Scroll progress: the back-to-top ring.** There used to be a hairline across the
very top of the viewport as well. It reported the same number twice, and it sat in
the browser's own chrome line where it read as part of the browser rather than
part of the page. The circle carries `pathLength="100"`, so the offset is the
percentage left.

**The journey.** The spine reports how far through `<main>` you are; the band whose
middle is nearest the centre of the viewport lights its dot and its nav link. (The
mobile menu button and its full-screen panel used to live here.)

**Scroll-linked sections.** Anything with `data-sc` gets `--p` set to how far it
has travelled through the viewport — 0 as its top reaches the bottom edge, 1 once
it has risen to the upper third. CSS does the rest, which keeps the interpolation
on the compositor and makes scrubbing back up rewind the animation. A figure
counting up alongside the bar that represents it is driven by the same value, or
the two disagree mid-scroll.

Number grouping follows the language on screen — 1,281 in English is 1.281 in
Turkish, and the paragraph beside the counter already writes it that way. The
locale is cached against `<html lang>` rather than rebuilt per frame, and
re-derived by that same check when the language changes, so no listener is needed
there; but nothing re-runs on its own once the page has settled, so the
`fl:langchange` handler asks for the figures to be re-written.

**Dashboard tour tabs** are a real tablist: arrow keys move between tabs, and the
sidebar of the mock window follows along so the two halves never disagree. Each
pane names which chrome in the mock window it belongs under, rather than matching
by index — the window's tab strip has two entries and the sidebar one more, but
there are four panes, because Compare lives inside Detailed Analysis and so two
panes light the same tab. The mock window's chrome used to be clickable, back when
its sidebar had one item per pane; it no longer is, and the elements it lights up
live inside `aria-hidden="true"`, so they must not become controls.

**Reveal** is one-shot and staggered within each group, capped so the last item in
a long group never feels like it is lagging. A load-time safety net shows anything
still hidden but on screen: an element must never be stranded invisible by a
missed observer callback.

---

## 12. `motion.js` — the animated set pieces

Each one demonstrates a real product behaviour rather than decorating the page:
the hero loses followers, the scanner collects, the tabs show what the results
view shows. Everything here is decorative in the accessibility sense (the
containers are `aria-hidden` and the same facts are in the prose), so under
`prefers-reduced-motion` this file does nothing at all and CSS leaves every piece
in a composed resting state.

**The scroll-scrubbed pieces — the chart, the export deck, the quality meter — are
not here.** They are pure CSS driven by the `--p` custom property that `main.js`
writes from scroll position, so that scrubbing back up rewinds them.

**Every loop is driven by an IntersectionObserver and stops when its section
leaves the viewport.** A page this animated should cost nothing while you are
reading a different part of it. `whileVisible` runs `start` while the element is on
screen and calls `stop` when it leaves; `onceVisible` runs once, the first time.

**`hue()` gives a stable colour per handle**, so a person keeps their colour across
sections. It hashes the whole handle, not just its first character: with the
previous roster the initials happened to be spread out, but this one has three
names starting with s and three with m, and one character in meant the scanner
list showed the same colour three rows apart and read as a repeat.

**The rotator's `fit()`** — the words are absolutely positioned, so the box has no
width of its own. It reserves the **widest** of them, not the current one: sizing
to each word in turn re-flows the headline every few seconds, and once a word is
long enough to push the following text past the end of the line, the whole sentence
jumps between two and three lines as it cycles. It re-measures after
`document.fonts.ready` (web fonts land after first paint and change every
measurement) and after `fl:langchange` (Turkish words are a different length). The
box widens before the word arrives: fading it in at the same moment left a longer
word still clipped by overflow while it was already legible, which reads as a
rendering fault rather than as motion.

**The scanner's roster is sixteen names**, so the window never repeats a face
within one pass of the list. These are the account being scanned in that section —
@mtvrkan's own followers — so nobody from the worked example in section 03, which
is a different account's data, appears here. Any handle that does show up in two
places is spelled identically in both: `hue()` derives the avatar colour from it,
and one person in two colours reads as two people. Initials are cased for the
language on screen: Turkish uppercases i to İ, and a roster of Turkish handles is
exactly where a plain `toUpperCase()` shows its seam — İsmail's avatar would read
as a Latin I. The list is trimmed to seven children so the window shows the newest
rows without a scrollbar, and both badge states are re-read after a language swap.

**The results tabs** hold one set per tab, and no name in two of them. The sets
used to be overlapping windows onto a single list, so the same five faces showed up
under "not following back" and again under "mutuals" — which is not a thing that
can be true of one person at once, and the demo was making the categories look
arbitrary. "Unfollowed you" holds the same three the hero card and section 01 name,
because all three are the same story told at different depths. Pill wording follows
the tab labels, which i18n already translates, and a deliberate click owns the
panel from then on.

**`void card.offsetWidth`** in the hero loop is a forced reflow, so removing and
re-adding the class restarts the animation.

---

## 13. `i18n.js` — the English/Turkish swap

The markup ships English so crawlers and social unfurlers get real text without
running scripts; Turkish is swapped in at runtime. A Turkish browser lands on
Turkish automatically, and the choice is remembered after that.

**Three ways to carry a key**, because three things need translating and they are
not written the same way:

| Attribute | Written with | For |
| --- | --- | --- |
| `data-i18n` | `textContent` | the default; `<title>` works with it, since `document.title` is that element's text |
| `data-i18n-html` | `innerHTML` | only for strings that carry markup the sentence would lose otherwise |
| `data-i18n-content` | the `content` attribute | `<meta>`; a description or an `og:title` has no text node to write to |

Only keys explicitly marked as markup go through `innerHTML`; everything else is
written as text or as an attribute, so a stray `<` in a translation is inert. An
HTML entity inside a `data-i18n` string renders as its literal characters — write
the character.

**The `data-en` guard is the whole reason this file runs unmodified on both
pages.** English lives in the markup, so it is captured once as the fallback
rather than duplicated into a second dictionary that could drift. Except on
`/tr/`, where the markup is already Turkish and the English original was written
into `data-en` by `scripts/build-tr.mjs`: capturing there would record Turkish as
the English fallback and the toggle would have nothing to switch back to, so an
existing `data-en` is left alone.

**A page that declares its own language wins outright.** `/tr/` exists so that an
unfurler and a crawler get Turkish out of the raw HTML; if a stored preference or
a browser locale could then flip it to English on load, the URL, the canonical, the
hreflang and the card would all be saying one thing and the page another.

`localStorage` reads and writes are wrapped in `try/catch` because private mode
throws on both.

**Set pieces measure their own text**, so a switch dispatches `fl:langchange` for
them.

### The mock screenshots' dates and figures

Neither can be literal text. A month name written into the markup stays English
beside Turkish prose, and a grouped figure written as `1,284` stays comma-grouped
where the paragraph beside it already says `1.284`. So both are declared as data
and formatted in the language now on screen:

| Attribute | Meaning |
| --- | --- |
| `data-date="-8"` | days from today, 0 being today |
| `data-date-pad` | two-digit day (04 rather than 4) |
| `data-date-time="14:20"` | appended after a middot |
| `data-date-range="-8,0"` | two offsets, joined with an arrow |
| `data-date-range-tight` | print the month once when both share one |
| `data-num="1284"` | a figure, grouped for the locale |

Offsets rather than fixed dates, for the same reason the hero's "yesterday" is
computed: a landing page still dated last August reads as abandoned. The hero card
claims the previous scan was yesterday's, so the date has to actually be
yesterday's.

Both dates inside one month print the month once, the way a real date range is
written; across a month boundary that would be ambiguous, so the tight form
quietly falls back to the full one.

**Case is left to CSS.** `.mono` carries `text-transform: uppercase`, and because
`<html lang>` is set before this runs, the browser casts Turkish with Turkish
rules — "Eki" becomes "EKİ", not "EKI", which no `toUpperCase()` without an
explicit locale would get right.

---

## 14. Notes on the Turkish copy

These sit with the dictionary in `i18n.js`.

- **`meta.title`** is kept keyword-bearing rather than clever: it is the one string
  that also has to work in a search result, and a Turkish reader should not be
  looking at an English tab. **`meta.desc`** is held to the same ~160-character
  budget as the English, for the same reason — past that a search result just cuts
  the sentence off.
- **`nav.stalk`** is short on purpose. The header island has a fixed width and the
  full phrase ("Kim kimi takip ediyor") wrapped to two lines there.
- **`stalk.w1`–`w5`** are kept close in length on purpose: the rotator reserves its
  widest word so the headline cannot reflow, which means a short word sits in a
  visibly wide gap. These run 10–18 characters instead of 7–13. "hoşlandığınız
  kişi" is the widest and sets that reserved width single-handedly — it is also the
  one the whole section is really about, so it earns the space. They are
  capitalised because with "Peki" gone each of them now opens the sentence. "İş",
  with the dotted capital — Turkish, not "Is".
- **`stalk.c1t`** and its siblings sit side by side, so they are written to roughly
  the same length in both languages: a two-line card next to a five-line one leaves
  a hole in the row that reads as a layout fault.
- **`how.s1t`** — the extension opens the list itself (`instagramAdapter.openList`
  clicks the stat control, `githubAdapter.openList` navigates to `?tab=`). Telling
  people to find the list first described a step they never take.
- **`dash.win`** is taken verbatim from the extension's own `src/locales/tr.json`,
  so the mock window is labelled exactly the way the product is. "followlens" is
  the product, so it stays; only the word for what is open in it is translated.

---

## 15. Things that were removed, and why

Kept here so they do not get reinvented.

| Removed | Why |
| --- | --- |
| Google Fonts `<link>` | Sent every visitor's IP and User-Agent to Google, on the page that says nothing is sent anywhere. Self-hosted now. |
| Italic serif display accent | At 66px it read as an invitation, not as software — and once the last phrase using it was rewritten, a whole font was downloading for nothing. |
| Mobile menu button and full-screen panel | It listed the sections in the order you meet them by scrolling, which is the only thing the page does. |
| Footer link row, both pages | A footer is a signature line, not a second navigation. |
| Hairline scroll bar across the top of the viewport | Reported the same number as the back-to-top ring, and sat in the browser's own chrome line. |
| Clickable chrome on the mock window | Its elements live inside `aria-hidden="true"`; they must not be controls. |
| Conic `--ig` | On a 21px dot the visible face was almost all yellow-to-orange, with none of the magenta the mark is known for. |
| Row-by-row tint on the comparison table | A muddy stripe across the whole table that highlighted nothing. |
| Full-bleed 2px Instagram bar on the hero card | Terminated in two hard stops at the rounded corners and read as a stray line. |
| Overlapping demo sets in the results tabs | The same face under "not following back" and "mutuals" made the categories look arbitrary. |
| Invented four-item nav in the dashboard mock | It does not exist anywhere in the product. |
| "Public accounts only" in section 03 | Both wrong and needlessly narrow: the line is openable-vs-not, not public-vs-private. |
| Comments in the served files | `docs/` is published byte for byte; this file is where they went. |
