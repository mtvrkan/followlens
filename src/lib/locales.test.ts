import { describe, expect, it } from 'vitest'
import en from '../locales/en.json'
import tr from '../locales/tr.json'
import de from '../locales/de.json'
import es from '../locales/es.json'
import fr from '../locales/fr.json'
import pt from '../locales/pt.json'
import ru from '../locales/ru.json'
import ja from '../locales/ja.json'
import zh from '../locales/zh.json'
import ar from '../locales/ar.json'

const catalogs: Record<string, Record<string, string>> = { tr, de, es, fr, pt, ru, ja, zh, ar }
const enKeys = Object.keys(en).sort()

// Guards the "every string localized in every language" invariant: a key
// added to en.json without all nine translations fails here, not in front
// of a user as a raw fallback string.
describe('locale catalogs', () => {
  for (const [code, catalog] of Object.entries(catalogs)) {
    it(`${code} has exactly the same keys as en`, () => {
      expect(Object.keys(catalog).sort()).toEqual(enKeys)
    })
  }

  it('interpolation placeholders match en in every catalog', () => {
    const placeholders = (value: string) => (value.match(/\{\{\w+\}\}/g) ?? []).sort()
    for (const [code, catalog] of Object.entries(catalogs)) {
      for (const key of enKeys) {
        expect(placeholders(catalog[key]), `${code}:${key}`).toEqual(placeholders((en as Record<string, string>)[key]))
      }
    }
  })

  // Key parity alone was never the invariant this suite claims to hold: for a
  // long stretch every catalog had all 297 keys while 96 of them were still
  // verbatim English, so roughly a third of the UI shipped untranslated in
  // eight languages with the suite green the whole time. A string that is
  // byte-identical to English is therefore treated as untranslated unless it
  // is listed below as a word that genuinely does not change in that language.
  const IDENTICAL_BY_DESIGN: Record<string, string[]> = {
    // Brand name and file-format acronyms — unchanged everywhere.
    '*': ['appName', 'exportFormatCsv', 'exportFormatJson', 'exportFormatPdf'],
    de: ['exportColumn_tags', 'exportFormat', 'themeSystem', 'reportScans'],
    es: ['storageUsageTotal', 'reportNo'],
    fr: ['exportFormat', 'tableDate', 'storageUsageTotal', 'reportScans'],
    pt: ['storageUsageTotal'],
    tr: ['exportColumn_platform'],
    ru: [],
    ja: [],
    zh: [],
    ar: [],
  }

  for (const [code, catalog] of Object.entries(catalogs)) {
    it(`${code} has no strings left verbatim in English`, () => {
      const allowed = new Set([...IDENTICAL_BY_DESIGN['*'], ...(IDENTICAL_BY_DESIGN[code] ?? [])])
      const untranslated = enKeys.filter((key) => !allowed.has(key) && catalog[key] === (en as Record<string, string>)[key])
      expect(untranslated, `${code} still shows English for these keys`).toEqual([])
    })
  }
})
