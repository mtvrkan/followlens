import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
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

/**
 * Single source of truth for the in-app language switcher. `label` is each
 * language's own name (never translated — users hunting for their language
 * must be able to recognize it), `dir` drives the document direction.
 * Codes are bare (pt = pt-BR content, zh = zh-CN content) so i18next's
 * `load: 'languageOnly'` normalization maps every regional variant onto them.
 */
export const SUPPORTED_LANGUAGES: { code: string; label: string; dir: 'ltr' | 'rtl' }[] = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', dir: 'ltr' },
  { code: 'de', label: 'Deutsch', dir: 'ltr' },
  { code: 'es', label: 'Español', dir: 'ltr' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'pt', label: 'Português (Brasil)', dir: 'ltr' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'ja', label: '日本語', dir: 'ltr' },
  { code: 'zh', label: '中文（简体）', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
]

const resources = {
  en: { translation: en },
  tr: { translation: tr },
  de: { translation: de },
  es: { translation: es },
  fr: { translation: fr },
  pt: { translation: pt },
  ru: { translation: ru },
  ja: { translation: ja },
  zh: { translation: zh },
  ar: { translation: ar },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    // A detected browser locale like "tr-TR" makes i18next resolve
    // translations fine via fallback matching, but `i18n.language` itself
    // stays "tr-TR" — this option only normalizes `i18n.resolvedLanguage`
    // ("tr"). Consumers matching against SelectItem values ("tr"/"en") must
    // read `resolvedLanguage`, not `language`, or the switcher renders blank.
    load: 'languageOnly',
    interpolation: { escapeValue: false },
  })

/** Writing direction for a language code — also used by the exported HTML/PDF report, which carries its own `dir`. */
export function directionFor(language: string | undefined): 'ltr' | 'rtl' {
  return SUPPORTED_LANGUAGES.find((l) => l.code === language)?.dir ?? 'ltr'
}

/** Keeps <html> dir/lang in sync with the active language (RTL support). */
export function applyDocumentDirection(language: string): void {
  document.documentElement.setAttribute('dir', directionFor(language))
  document.documentElement.setAttribute('lang', language)
}

/**
 * The page's own name for itself, resolved through i18next rather than baked
 * into each index.html — a static <title> stayed English no matter what the
 * user picked, and it is the one piece of UI that shows up outside the app
 * (browser tab, window switcher, history).
 *
 * A resolver rather than a plain key because the pages don't share one shape:
 * two are "Brand — Section" built from terms that already exist in every
 * catalog, and onboarding's title is a whole sentence.
 */
type TitleResolver = (translate: typeof i18n.t) => string

let titleResolver: TitleResolver | null = null

function applyDocumentTitle(): void {
  if (titleResolver) document.title = titleResolver(i18n.t.bind(i18n))
}

/** Call once per page, before render. Re-applies itself on every language change. */
export function setDocumentTitle(resolve: TitleResolver): void {
  titleResolver = resolve
  applyDocumentTitle()
}

i18n.on('languageChanged', () => {
  applyDocumentDirection(i18n.resolvedLanguage ?? 'en')
  applyDocumentTitle()
})
applyDocumentDirection(i18n.resolvedLanguage ?? 'en')

export default i18n
