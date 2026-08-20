# Contributing to FollowLens

Issues and pull requests are welcome. Setup, the scripts table and how to load a
source build are in [INSTALL.md](INSTALL.md).

## Before you open a PR

- **Run `npm run verify`.** It is the same chain CI runs — lint, types, 351 tests, site checks, build — and it is fast.
- **Behaviour changes need a test.** Most of the interesting logic (diffing, row building, scan quality, platform parsing) is pure and already covered; add to the neighbouring `*.test.ts`.
- **Add a CHANGELOG entry** in plain language: what changed and why, not which function moved.
- **Please don't add dependencies** without a reason worth stating. The extension ships React, Dexie and i18next, and that is meant to stay boring.

Anything touching collection behaviour, storage or permissions is worth opening an issue about first. Those are the parts where "obviously better" has repeatedly turned out to be wrong on a real Instagram account.

## Layout

```
src/
  manifest.ts        MV3 manifest, generated from the platform registry
  platforms/         One adapter per platform (instagram, github)
  injected/          MAIN-world script: passively observes the page's own
                     follower-list API responses, and runs the direct
                     list paging described below
  content/           Isolated-world script: bridges to background, reads
                     DOM-mode platforms, drives auto-scroll and the
                     on-page indicator
  background/        Service worker: validates and buffers reports, saves
                     snapshots, diffs
  shared/            Typed message protocol (Result envelope, sanitizers)
  lib/               Dexie DB, diff/rows/analytics/export pure logic, i18n
  popup/ dashboard/ options/ onboarding/   React UIs
  locales/           i18next catalogs (10 languages)
public/_locales/     chrome.i18n catalogs (manifest + on-page indicator)
```

## How a list is read

**DOM mode** (Instagram, GitHub) reads the rendered list straight off the page.
**JSON mode** relies on the page calling its own API as you scroll, with the MAIN-world script only reading those responses. No platform uses JSON mode as its primary path today, but Instagram layers it on top of its DOM reading as a second, more reliable source.

**Auto-Collect only automates scrolling** — or, on GitHub, following the "next page" link — and only after the user starts it from the popup. The resulting requests are the same ones their own scrolling would make.

**"Faster, more complete scans"** (Settings, on by default) is the one thing FollowLens requests on its own initiative: Instagram's own list endpoint, asked from that page with the session the user is already signed in with, and GitHub's public REST API. It exists because scroll-only reading was measured to miss real followers, which surfaces downstream as a *wrong* "doesn't follow back" list. [PRIVACY.md](PRIVACY.md) has the precise breakdown.

## Adding a platform

A new platform is a new adapter in `src/platforms/` plus its registry entry. The manifest's match patterns and the UI's platform lists are both generated from that registry, so there is no third place to remember.

Before writing one, read [DECISIONS.md](DECISIONS.md) §17 on why TikTok and X were removed. The bar is not "can it be scraped" but "can it produce follower data worth trusting" — a wrong "doesn't follow back" answer is worse than no answer, and an adapter that cannot clear that bar will not be merged.

## Two things that are not open for change without discussion

- **No backend.** Every claim the project makes rests on there being nothing to send data to. A feature that needs a server is a different project.
- **It only reads.** There is no code path that posts, follows, unfollows, likes or messages, and there will not be one. That is what keeps the permission set defensible and the extension in the store.
