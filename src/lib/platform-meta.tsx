import { Github, Instagram } from 'lucide-react'
import type { ComponentType } from 'react'
import type { PlatformId } from '../platforms/types'

export const PLATFORM_ICONS: Record<PlatformId, ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  github: Github,
}

// A light brand touch on the platform icon itself (select trigger/items,
// onboarding) — everything else in the UI stays neutral so this doesn't turn
// into competing color schemes.
export const PLATFORM_ICON_CLASSES: Record<PlatformId, string> = {
  instagram: 'text-instagram',
  github: 'text-github',
}
