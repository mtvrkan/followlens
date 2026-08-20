import { describe, expect, it } from 'vitest'

/**
 * The `_locales/` catalog is a different one from `src/locales/` (covered by
 * lib/locales.test.ts): Chrome itself reads these for the store listing, the
 * extensions page and `chrome.i18n.getMessage` in the on-page indicator. A key
 * missing here doesn't fall back to English — the store listing renders the raw
 * `__MSG_appName__` placeholder, and the indicator loses its label. Nothing in
 * the build checks it, hence this.
 */

interface MessageEntry {
  message: string
  description?: string
}

const catalogs = import.meta.glob('../../public/_locales/*/messages.json', { import: 'default', eager: true }) as Record<
  string,
  Record<string, MessageEntry>
>

function localeOf(path: string): string {
  return path.split('/').slice(-2)[0]
}

const byLocale = new Map(Object.entries(catalogs).map(([path, catalog]) => [localeOf(path), catalog]))
const english = byLocale.get('en')

// Mirrors src/locales/i18n.ts's SUPPORTED_LANGUAGES, in Chrome's own locale
// naming (pt_BR / zh_CN rather than pt / zh).
const EXPECTED_LOCALES = ['en', 'tr', 'de', 'es', 'fr', 'pt_BR', 'ru', 'ja', 'zh_CN', 'ar']

describe('store message catalogs (_locales)', () => {
  it('ships one catalog per supported language', () => {
    expect([...byLocale.keys()].sort()).toEqual([...EXPECTED_LOCALES].sort())
  })

  it('has an English catalog to compare against', () => {
    expect(english).toBeDefined()
  })

  for (const locale of EXPECTED_LOCALES) {
    it(`${locale} defines every key with a non-empty message`, () => {
      const catalog = byLocale.get(locale)
      expect(catalog, locale).toBeDefined()
      expect(Object.keys(catalog ?? {}).sort()).toEqual(Object.keys(english ?? {}).sort())
      for (const [key, entry] of Object.entries(catalog ?? {})) {
        expect(entry.message, `${locale}:${key}`).toBeTruthy()
      }
    })
  }

  it('keeps the manifest placeholders the manifest actually references', () => {
    // src/manifest.ts uses __MSG_appName__ / __MSG_appDesc__; the indicator uses
    // the other two via chrome.i18n.getMessage.
    for (const key of ['appName', 'appDesc', 'indicatorCollecting', 'indicatorStop']) {
      expect(english, key).toHaveProperty(key)
    }
  })
})
