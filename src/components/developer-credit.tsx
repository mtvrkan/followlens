import { Heart } from 'lucide-react'
import { DEVELOPER_NAME, DEVELOPER_URL } from '../lib/developer'
import { cn } from '../lib/utils'

interface DeveloperCreditProps {
  className?: string
}

/**
 * "Developed with ♥ by mtvrkan", shown in the popup footer, the settings page
 * and the dashboard sidebar. One component rather than three copies so the
 * wording, the link target and the animation can never drift between surfaces.
 *
 * Deliberately NOT translated: this is a signature, and a signature reads the
 * same in every language. That is also why it is a plain string here rather
 * than an i18n key — there is nothing for a translator to pick up by mistake.
 */
export function DeveloperCredit({ className }: DeveloperCreditProps) {
  return (
    <p className={cn('text-2xs text-muted-foreground', className)} lang="en">
      Developed with{' '}
      <Heart
        aria-label="love"
        role="img"
        className="inline-block h-3 w-3 shrink-0 animate-heartbeat fill-destructive align-[-0.125em] text-destructive"
      />{' '}
      by{' '}
      <a
        href={DEVELOPER_URL}
        target="_blank"
        rel="noreferrer"
        className="rounded font-medium transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {DEVELOPER_NAME}
      </a>
    </p>
  )
}
