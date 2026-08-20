# Installing FollowLens

[English] · [Türkçe](INSTALL.tr.md)

## From the Chrome Web Store

**[chromewebstore.google.com/detail/jpejnlkciiphkcnlncljikpgekbcglfl](https://chromewebstore.google.com/detail/jpejnlkciiphkcnlncljikpgekbcglfl)**

Tested on **Chrome** and **Brave**. The rest of Chromium will very likely run it, and each browser goes on this list once it has actually been checked rather than on the strength of "very likely".

## From source

Takes about a minute. You need [Node.js](https://nodejs.org) 20 or newer.

```bash
git clone https://github.com/mtvrkan/followlens.git
cd followlens
npm ci
npm run build
```

That writes the extension to `dist/`. Then, in Chrome:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the **`dist`** folder — not the repository root

The FollowLens icon appears in the toolbar. Pin it if you want it visible.

**If the extension shows up as `__MSG_appName__`** you selected the repository root instead of `dist`.

### Updating a source install

```bash
git pull
npm ci
npm run build
```

Then press the reload arrow on the FollowLens card in `chrome://extensions`. Your saved scans are not touched by a rebuild — they live in the browser's own database, keyed to the extension, not in the build output.

## Removing it, and your data

Removing the extension from Chrome deletes everything it stored: there is no server copy, because there is no server. If you want to clear your scans without uninstalling, **Settings → Delete all data** does the same job.

To keep your history first, export a backup from **Settings → Export backup**. It restores into a fresh install, on this machine or another.

## Development

```bash
npm run dev
```

Starts the CRXJS dev server with hot reload. Load `dist/` the same way as above; it reloads itself as you edit.

| Command | What it does |
|---|---|
| `npm run verify` | Everything below, in the order CI runs it. Use this before opening a PR. |
| `npm run build` | Type-check (`tsc -b`) + production build (Vite + CRXJS) |
| `npm test` | Vitest unit suite — 351 tests |
| `npm run lint` | ESLint (flat config, typescript-eslint + react-hooks) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:site` | Loads all three landing pages, runs their scripts, checks translations and outbound requests |
| `npm run dev` | Dev server with extension hot reload |

Architecture, the platform-adapter layer and the house rules for changes are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Building the store package

```bash
npm ci && npm run build
```

Then zip the **contents** of `dist/` — not the folder itself, or `manifest.json` ends up one level down and the upload is rejected. On Windows, avoid PowerShell's `Compress-Archive`: it writes `\` path separators inside the archive, which the ZIP format does not allow.
