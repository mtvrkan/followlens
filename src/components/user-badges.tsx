import { BadgeCheck, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SocialUser } from '../platforms/types'

/** Inline verified/private indicators next to a username — shared by every list that renders a `SocialUser` row. */
export function UserBadges({ user }: { user: Pick<SocialUser, 'isVerified' | 'isPrivate'> }) {
  const { t } = useTranslation()
  if (!user.isVerified && !user.isPrivate) return null

  return (
    <span className="inline-flex shrink-0 items-center gap-1 align-middle">
      {/* role="img" is what makes aria-label count: ARIA forbids naming a
          generic element, so a bare labelled <span> was announced as nothing at
          all — the verified/private status was visible but invisible to screen
          readers. */}
      {user.isVerified && (
        <span role="img" title={t('verifiedBadge')} aria-label={t('verifiedBadge')}>
          <BadgeCheck className="h-3.5 w-3.5 text-primary" />
        </span>
      )}
      {user.isPrivate && (
        <span role="img" title={t('privateBadge')} aria-label={t('privateBadge')}>
          <Lock className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
    </span>
  )
}
