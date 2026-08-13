# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com).

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
