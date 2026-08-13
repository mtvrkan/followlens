import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    // Chrome rejects <link rel="modulepreload"> inside extension pages
    // ("cross-world extension resource mismatch"), so the preloads never help
    // and only spam the console. Modules still load via their import chain.
    modulePreload: false,
    rollupOptions: {
      // crxjs only auto-discovers HTML pages referenced from the manifest
      // (default_popup, options_ui, etc). Dashboard/onboarding are opened via
      // chrome.tabs.create at runtime instead, so they need to be listed
      // explicitly or they never get built.
      input: {
        dashboard: resolve(__dirname, 'src/dashboard/index.html'),
        onboarding: resolve(__dirname, 'src/onboarding/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    ws: { port: 5173 },
  },
})
