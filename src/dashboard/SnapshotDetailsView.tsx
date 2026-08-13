import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, FileJson } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { SnapshotList } from './SnapshotList'
import { csvDelimiterFor, downloadFile, toCsv } from '../lib/export'
import { toDateInputValue } from '../lib/format'
import type { PlatformId, Snapshot } from '../lib/types'

interface SnapshotDetailsViewProps {
  snapshot: Snapshot
  platform: PlatformId
  accountId: string
  onBack: () => void
}

export function SnapshotDetailsView({ snapshot, platform, accountId, onBack }: SnapshotDetailsViewProps) {
  const { t, i18n } = useTranslation()
  const [activeList, setActiveList] = useState<'followers' | 'following'>('followers')

  function exportCsv() {
    const users = activeList === 'followers' ? snapshot.followers : snapshot.following
    downloadFile(
      `followlens-${platform}-${accountId}-${toDateInputValue(snapshot.takenAt)}-${activeList}.csv`,
      toCsv(
        ['username', 'displayName'],
        users.map((u) => [u.username, u.displayName]),
        csvDelimiterFor(i18n.resolvedLanguage),
      ),
      'text/csv;charset=utf-8;',
    )
  }

  function exportJson() {
    downloadFile(
      `followlens-${platform}-${accountId}-${toDateInputValue(snapshot.takenAt)}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json',
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            className="flex items-center gap-1 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={onBack}
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" />
            {t('backButton')}
          </button>
          <p className="mt-1 text-sm font-medium">{new Date(snapshot.takenAt).toLocaleString(i18n.language)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5 shrink-0" />
            {t('exportCsv')}
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={exportJson}>
            <FileJson className="h-3.5 w-3.5 shrink-0" />
            {t('exportJson')}
          </Button>
        </div>
      </div>

      <Tabs value={activeList} onValueChange={(value) => setActiveList(value as 'followers' | 'following')}>
        <TabsList>
          <TabsTrigger value="followers">{t('followersCountTab', { count: snapshot.followers.length })}</TabsTrigger>
          <TabsTrigger value="following">{t('followingCountTab', { count: snapshot.following.length })}</TabsTrigger>
        </TabsList>
        <TabsContent value="followers" className="mt-4">
          <SnapshotList users={snapshot.followers} platform={platform} />
        </TabsContent>
        <TabsContent value="following" className="mt-4">
          <SnapshotList users={snapshot.following} platform={platform} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
