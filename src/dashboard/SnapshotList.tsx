import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Inbox, RotateCcw, Search } from 'lucide-react'
import { Avatar } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { UserBadges } from '../components/user-badges'
import { profileUrl } from '../lib/profile-url'
import type { PlatformId, SocialUser } from '../lib/types'

interface SnapshotListProps {
  users: SocialUser[]
  platform: PlatformId
}

/** Plain follower/following list for a single snapshot — no diff, no category tags, just who was there at that point in time. */
export function SnapshotList({ users, platform }: SnapshotListProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.toLowerCase()
    if (!query) return users
    return users.filter((u) => u.username.toLowerCase().includes(query) || u.displayName.toLowerCase().includes(query))
  }, [users, search])

  return (
    <div className="space-y-3">
      {/* Logical start-2/ps-8 (not left-2/pl-8) so the icon and the room made
          for it stay on the same side under dir="rtl". */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label={t('searchPlaceholder')}
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-8"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-border shadow-sm">
        {filtered.length === 0 && (
          <div className="flex animate-fade-up flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              {search ? (
                <Search className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Inbox className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{search ? t('noSearchResults', { search }) : t('emptyState')}</p>
            {search && (
              <Button size="sm" variant="outline" className="mt-1 gap-2" onClick={() => setSearch('')}>
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                {t('clearSearch')}
              </Button>
            )}
          </div>
        )}
        <div className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {filtered.map((user, index) => (
            <a
              key={user.username}
              href={profileUrl(platform, user.username)}
              target="_blank"
              rel="noreferrer"
              className="flex animate-fade-up items-center gap-3 p-3 transition-colors hover:bg-muted hover:ring-1 hover:ring-inset hover:ring-border"
              style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }}
            >
              <Avatar src={user.avatarUrl} fallbackText={user.username} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-medium">
                  <span className="min-w-0 truncate">@{user.username}</span>
                  <UserBadges user={user} />
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.displayName}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
