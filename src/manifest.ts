import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'
import { manifestMatchPatterns, manifestMatchPatternsForInjectedScript } from './platforms/registry'

const allMatches = manifestMatchPatterns()

export default defineManifest({
  manifest_version: 3,
  // Store-visible strings come from public/_locales/<locale>/messages.json
  // so the listing localizes with the browser UI language.
  name: '__MSG_appName__',
  description: '__MSG_appDesc__',
  default_locale: 'en',
  version: pkg.version,
  icons: {
    16: 'public/icon16.png',
    48: 'public/icon48.png',
    128: 'public/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      // Every adapter that needs the MAIN world — for passive network
      // interception (matchRequest), for active list pagination (selfFetch), or
      // both — regardless of dom/json mode. Instagram is dom-mode but wants
      // interception as a supplementary data source (see FRIENDSHIP_API_RE in
      // platforms/instagram.ts); GitHub has nothing to intercept but does
      // self-fetch its public REST API from here.
      matches: manifestMatchPatternsForInjectedScript(),
      js: ['src/injected/injected-script.ts'],
      world: 'MAIN',
      run_at: 'document_start',
    },
    {
      // All platforms: bridges JSON-mode messages to the background, and
      // additionally drives DOM-mode platforms (GitHub) directly.
      matches: allMatches,
      js: ['src/content/content-script.ts'],
      run_at: 'document_start',
    },
  ],
  permissions: ['storage', 'scripting', 'activeTab'],
  host_permissions: allMatches,
})
