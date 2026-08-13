import { useEffect, useRef, useState } from 'react'
import { getAdapterForHost } from '../platforms/registry'
import type { PlatformId } from '../platforms/types'
import { detectAccountFromUrl } from './active-account'

interface ActiveTabSelection {
  platform: PlatformId | null
  accountId: string | null
}

async function detectActiveTabSelection(): Promise<ActiveTabSelection> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.url) return { platform: null, accountId: null }
    const platform = getAdapterForHost(new URL(tab.url).hostname)?.id ?? null
    return { platform, accountId: platform ? detectAccountFromUrl(platform, tab.url) : null }
  } catch {
    return { platform: null, accountId: null }
  }
}

/**
 * Resolves which platform/account to show: the platform open in the user's
 * current tab takes priority (so the popup matches whatever site they're
 * on), falling back to the last platform/account the background worker saw
 * data for. Shared by popup and dashboard so both default consistently —
 * on the dashboard's own tab nothing matches, so it naturally falls back to
 * the last-used platform.
 */
export function useAccountSelection() {
  const [platform, setPlatformState] = useState<PlatformId | null>(null)
  const [lastAccounts, setLastAccounts] = useState<Partial<Record<PlatformId, string>>>({})
  const [activeAccounts, setActiveAccounts] = useState<Partial<Record<PlatformId, string>>>({})
  const [manualAccounts, setManualAccounts] = useState<Partial<Record<PlatformId, string>>>({})
  const [resolved, setResolved] = useState(false)
  // True once the caller (Popup's platform Select, Dashboard's Sidebar)
  // explicitly picks a platform — from then on, storage's `lastPlatform`
  // changing (e.g. a scan starting on some other platform/tab) must not
  // silently override that choice.
  const manuallySelected = useRef(false)
  // True only when initial resolution had no active-tab platform to prefer
  // and fell back to storage (the dashboard's own tab never matches one).
  // Gates the live-follow below so it never fires for the popup, whose
  // whole point is to prefer whatever the active tab actually is.
  const usingStoredFallback = useRef(false)

  const setPlatform = (next: PlatformId) => {
    manuallySelected.current = true
    setPlatformState(next)
  }

  const setAccount = (next: string) => {
    if (!platform) return
    setManualAccounts((current) => ({ ...current, [platform]: next }))
  }

  useEffect(() => {
    let cancelled = false

    // A page open across an extension reload gets "Extension context
    // invalidated" from every chrome.* call. Unhandled, that surfaces as an
    // extension error; handled, the UI stays on its defaults until the tab is
    // reloaded, which is the only real recovery anyway.
    const EMPTY: [Record<string, unknown>, ActiveTabSelection] = [{}, { platform: null, accountId: null }]

    Promise.all([chrome.storage.local.get(['lastPlatform', 'lastAccounts']), detectActiveTabSelection()])
      .catch(() => EMPTY)
      .then(([stored, detected]) => {
        if (cancelled) return
        const storedPlatform = (stored.lastPlatform as PlatformId | undefined) ?? null
        usingStoredFallback.current = detected.platform === null
        setLastAccounts((stored.lastAccounts as Partial<Record<PlatformId, string>> | undefined) ?? {})
        setActiveAccounts(detected.platform && detected.accountId ? { [detected.platform]: detected.accountId } : {})
        setPlatformState(detected.platform ?? storedPlatform)
        setResolved(true)
      })

    // Without this, a popup opened before any scan has ever run for the
    // active account stays stuck showing accountId=null even after the
    // content script's first report sets it in the background — the
    // popup would need to be closed and reopened to notice.
    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') return
      if (changes.lastAccounts) {
        setLastAccounts((changes.lastAccounts.newValue as Partial<Record<PlatformId, string>> | undefined) ?? {})
      }
      // Keeps a long-lived dashboard tab in sync when a scan starts on a
      // platform that had never been tracked before — otherwise it stays
      // stuck on whichever platform was last active when the tab was opened.
      if (changes.lastPlatform && usingStoredFallback.current && !manuallySelected.current) {
        setPlatformState((changes.lastPlatform.newValue as PlatformId | undefined) ?? null)
      }
    }
    chrome.storage.onChanged.addListener(listener)

    return () => {
      cancelled = true
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])

  const activeAccountId = platform ? (activeAccounts[platform] ?? null) : null
  const accountId = platform ? (manualAccounts[platform] ?? activeAccountId ?? lastAccounts[platform] ?? null) : null

  return { platform, accountId, activeAccountId, setPlatform, setAccount, lastAccounts, resolved }
}

/** Live `{ "platform:accountId": "@handle" }` map, kept in sync as the background worker learns new labels. */
export function useAccountLabels(): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({})

  useEffect(() => {
    chrome.storage.local
      .get('accountLabels')
      .then((result) => setLabels((result.accountLabels as Record<string, string> | undefined) ?? {}))
      // Same invalidated-context case as above: labels just stay empty, which
      // degrades to showing raw account ids rather than throwing.
      .catch(() => undefined)

    const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local' || !changes.accountLabels) return
      setLabels((changes.accountLabels.newValue as Record<string, string> | undefined) ?? {})
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  return labels
}
