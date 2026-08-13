import { useTranslation } from 'react-i18next'
import { Languages, Moon, Settings, Sun } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../lib/i18n'
import { BrandMark } from './brand-mark'
import { useTheme } from './theme-provider'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { cn } from '../lib/utils'

/** The brand header shared by popup, dashboard, options and onboarding: logo + language switcher + theme toggle. */
export function AppHeader({ className, showSettings = false }: { className?: string; showSettings?: boolean }) {
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()

  return (
    // `bg-card` rather than a gradient fading to transparent: on the dark theme
    // the transparent end let the strip dissolve into the page, so the top of
    // every screen read as empty black space with a logo floating in it instead
    // of as a header. py-2 with uniformly 32px-tall controls (brand block
    // included) is the other half of that — at py-3 with 36px controls the bar
    // was 60px tall around a 28px logo, leaving dead space above the brand.
    <header
      className={cn('flex items-center justify-between border-b border-border bg-card px-4 py-2', className)}
    >
      <div className="flex items-center gap-2">
        {/* The real mark, not a gradient square with Lucide's magnifier in it —
            the toolbar icon and the site have always drawn the lens with two
            accounts inside, and this was the one place that did not. rounded-lg
            over the plate's own 29/128 radius so it matches the 8px scale the
            rest of the chrome is built on at this size. */}
        <BrandMark className="h-8 w-8 rounded-lg shadow-sm" />
        <h1 className="text-sm font-semibold">{t('appName')}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Select value={i18n.resolvedLanguage ?? ''} onValueChange={(value) => i18n.changeLanguage(value)}>
          <SelectTrigger className="w-28" aria-label={t('changeLanguage')}>
            <Languages className="h-3 w-3 shrink-0 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label={t('toggleTheme')}
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        {showSettings && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label={t('openSettings')}
            // Same invalidated-context case the rest of the chrome.* call
            // sites handle: a page left open across an extension reload gets a
            // rejection here, and unhandled it surfaces as an extension error.
            // The button doing nothing until the tab is reloaded is the
            // acceptable outcome — reloading is the only real recovery anyway.
            onClick={() => void chrome.runtime.openOptionsPage().catch(() => undefined)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  )
}
