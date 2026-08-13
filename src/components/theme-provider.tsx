import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
const STORAGE_KEY = 'followlens-theme'

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): Theme {
  try {
    const stored = storage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  } catch {
    // localStorage can throw in restricted contexts — fall back to following
    // the OS rather than failing to render at all.
    return 'system'
  }
}

function resolveSystemTheme(): ResolvedTheme {
  // Guarded because this now runs at module evaluation (see below): a context
  // without `matchMedia` would otherwise throw before the app ever renders,
  // turning a missing OS hint into a blank page instead of the light theme.
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? resolveSystemTheme() : theme
}

/**
 * Writes the resolved theme onto <html>. `colorScheme` keeps native form
 * control chrome (placeholder color, scrollbars, date pickers) in sync with the
 * app's own active theme instead of the OS preference — without it, a page can
 * get browser-default dark styling on inputs while the app renders light.
 */
function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.style.colorScheme = resolved
}

// Applied at module evaluation — i.e. before createRoot().render() runs, so the
// very first paint already has the right theme. Doing this only inside the
// provider's effect meant a dark-theme user saw one white frame every single
// time the popup opened (the effect runs after the first paint), which reads as
// a flash rather than as a theme.
if (typeof document !== 'undefined') {
  applyTheme(resolveTheme(readStoredTheme(localStorage)))
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme(localStorage))
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredTheme(localStorage)))

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme)
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    apply()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
      if (!mediaQuery) return
      mediaQuery.addEventListener('change', apply)
      return () => mediaQuery.removeEventListener('change', apply)
    }
  }, [theme])

  function setTheme(next: Theme) {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Choice won't survive a reload, but the current session still switches.
    }
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}
