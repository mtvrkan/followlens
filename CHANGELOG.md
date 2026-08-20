# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com).

## [Unreleased]

### Changed

- Every author comment is stripped from the files the site actually serves — the four pages, `style.css`, the three scripts and `logo.svg`. Anyone can read them with view-source, and the site now ships only what the browser needs. `build-tr.mjs` no longer stamps a "generated, do not edit" banner into `docs/tr/index.html` either; that warning lives in `docs/README.md` and in the script's own header. The rendered text and element count of all three English pages are unchanged. [2026-08-20]

### Added

- `SITE-NOTES.md` — the reasoning that used to be those comments, all 234 of them, rewritten as a document rather than dropped: the three rules the page is built on, the token and lighting model, every section's layout decisions, the scroll journey, the i18n contract, the Turkish copy constraints, and a table of things that were removed so they do not get reinvented. Each note keeps an anchor to the selector or function it describes. Linked from both READMEs and from `docs/README.md`. [2026-08-20]
- The Chrome Web Store listing is approved and live, so nothing still says it is in review — the install sections of both READMEs, both INSTALL files, the note above the site's install button and the store checklist all read as shipped. Installing from source stays documented; it is a supported way in, not a stopgap. [2026-08-16]

### Fixed

- The site has a `favicon.ico` again — or rather for the first time. It shipped an SVG and 32/128px PNGs and no `.ico`, and Google Search, whose favicon crawler wants a square that is a multiple of 48px and falls back to `/favicon.ico` when it finds nothing usable, was drawing a generic globe next to every result. The icon is rendered from the same `logo.svg` as the toolbar icons, at 32, 48 and 96. [2026-08-14]
- The privacy policy is indexed at `/privacy`, not `/privacy.html`. GitHub Pages answers both with 200, so the page had two addresses and the canonical, the Open Graph URL, the sitemap and every link to it named the one with the extension. [2026-08-14]
- Links back to the home page no longer go through `/index.html`, which is a second address for the front page for the same reason. [2026-08-14]
- `brand-sources/render-icons.cjs` writes where it says it does. Its paths were still relative to `docs/assets/img/`, where it used to live, so a run produced a full icon set in the directory *above* the repository and left every real icon untouched — silently, because it prints paths relative to the same wrong root. [2026-08-14]

## [1.0.0] — 2026-08-13

First public release. Everything below is what shipped; there was no earlier
version anyone could install, so this is the whole product rather than a list of
changes to one.

### Added

- Follower and following scans for Instagram and GitHub, read from whatever profile you have open in your own signed-in session.
- Four result categories from the second scan on — not following back, unfollowed you, new followers, mutuals — each row opening the profile.
- Follower history chart, per-scan changes, and a date range you can narrow.
- Compare any two scans side by side, in both directions.
- Export to CSV, JSON, a printable HTML report or PDF, and a full backup that restores on another machine.
- Several accounts per platform, tracked separately, each with its own history.
- An ignore list, for accounts you would rather stop seeing.
- Scan-quality reporting: what was collected against what the platform's own count claimed, so a list is never called complete when it is known not to be.
- Auto-Collect, gesture-gated — it starts only on a click, shows a live badge on the page for its entire duration, and can always be stopped.
- Settings switches for direct list paging ("Faster, more complete scans", on by default) and for diagnostic logging (off by default).
- Ten languages, light / dark / system themes, and right-to-left support.
- Local-only storage. Your scans live in your browser's own IndexedDB. There is no account, no sign-in, no server to send anything to, and no analytics or telemetry.
- Landing page and privacy policy at followlens.mtvrkan.com, built from `docs/`.
- Continuous integration: lint, type-check, 351 tests, site checks and a production build on every push and pull request.

### Notes

- MIT licensed. The build is reproducible with `npm ci && npm run build`.
- The extension only reads. It never posts, follows, unfollows, likes or messages on your behalf, and it cannot read a list that would not open for you.
- TikTok and X are deliberately not supported: neither could produce follower data worth trusting, and a wrong "doesn't follow back" answer is worse than no answer. `DECISIONS.md` has the detail.
