import { useTranslation } from 'react-i18next'
import { ExternalLink, Eye, EyeOff } from 'lucide-react'
import { Avatar } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Dialog } from '../components/ui/dialog'
import { UserBadges } from '../components/user-badges'
import { FILTER_BADGE_TONES, FILTER_LABEL_KEYS } from './FilterCheckboxes'
import { profileUrl } from '../lib/profile-url'
import type { Row } from '../lib/rows'
import type { PlatformId } from '../lib/types'

interface RowDetailsDialogProps {
  row: Row | null
  platform: PlatformId | null
  onClose: () => void
  onToggleIgnored?: (row: Row) => void
}

/**
 * What clicking a row in the list opens: everything known about that person in
 * one place, plus the two actions worth taking on them (open their profile,
 * hide/unhide them from "not following back"). Replaces the old inline "review"
 * mode, which occupied a card above the list and only ever walked one category.
 */
export function RowDetailsDialog({ row, platform, onClose, onToggleIgnored }: RowDetailsDialogProps) {
  const { t } = useTranslation()
  if (!row) return null

  const canToggleIgnored = Boolean(onToggleIgnored) && (row.ignored || row.tags.includes('notFollowingBack'))

  return (
    <Dialog
      open
      onClose={onClose}
      // A generic title, not the handle: the identity block right below already
      // shows @username and display name, so putting them in the header too
      // printed the same two lines twice within a few pixels of each other.
      title={t('rowDetailsTitle')}
      className="max-w-md"
      footer={
        <>
          {canToggleIgnored && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                onToggleIgnored?.(row)
                onClose()
              }}
            >
              {row.ignored ? <Eye className="h-3.5 w-3.5 shrink-0" /> : <EyeOff className="h-3.5 w-3.5 shrink-0" />}
              {row.ignored ? t('unignoreUser') : t('ignoreUser')}
            </Button>
          )}
          {/* An anchor, not a Button with a click handler: opening a profile is a
              navigation, so middle-click and "open in new tab" should work. */}
          <a
            href={profileUrl(platform, row.username)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-gradient-brand px-3 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            {t('openProfile')}
          </a>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar src={row.avatarUrl} fallbackText={row.username} size={56} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-medium">
              <span className="min-w-0 truncate">@{row.username}</span>
              <UserBadges user={row} />
            </p>
            <p className="truncate text-xs text-muted-foreground">{row.displayName}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t('rowDetailsCategories')}</p>
          <div className="flex flex-wrap gap-2">
            {row.tags.map((tag) => (
              <Badge key={tag} variant={FILTER_BADGE_TONES[tag]}>
                {t(FILTER_LABEL_KEYS[tag])}
              </Badge>
            ))}
            {row.ignored && <Badge variant="muted">{t('ignoredBadge')}</Badge>}
          </div>
        </div>

        {/* Only the profile URL is spelled out here — username and display name
            are already in the identity block above, and repeating them in a
            details grid was a third copy of the same two strings. */}
        <dl className="text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <dt className="text-muted-foreground">{t('exportColumn_profileUrl')}</dt>
            <dd className="mt-1 truncate font-medium">{profileUrl(platform, row.username)}</dd>
          </div>
        </dl>
      </div>
    </Dialog>
  )
}
