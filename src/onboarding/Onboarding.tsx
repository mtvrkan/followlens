import { useTranslation } from 'react-i18next'
import { ListChecks, MousePointerClick, Save, ShieldCheck, Sparkles } from 'lucide-react'
import { ThemeProvider } from '../components/theme-provider'
import { AppHeader } from '../components/app-header'
import { Button } from '../components/ui/button'
import { PLATFORM_ICON_CLASSES, PLATFORM_ICONS } from '../lib/platform-meta'
import { platformHomeUrl } from '../lib/profile-url'
import { enabledAdapters } from '../platforms/registry'
import type { ComponentType, ReactNode } from 'react'
import '../lib/i18n'
import '../styles/globals.css'

function Step({
  index,
  isLast,
  icon: Icon,
  title,
  body,
}: {
  index: number
  isLast: boolean
  icon: ComponentType<{ className?: string }>
  title: string
  body: ReactNode
}) {
  return (
    <div
      className="flex animate-fade-up items-start gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="relative flex shrink-0 flex-col items-center self-stretch">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        {/* Connects this step's icon to the next one, giving the three steps
            a visual "path" rather than three disconnected cards. */}
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
      </div>
      <div className="pb-1">
        <h2 className="text-sm font-semibold">
          {index}. {title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

function OnboardingContent() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader className="px-6" showSettings />
      <main className="mx-auto max-w-xl space-y-6 p-6">
        <div className="animate-fade-up space-y-3 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-lg shadow-primary/20">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('onboardingTitle')}</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{t('onboardingSubtitle')}</p>
        </div>

        <div className="space-y-3">
          <Step index={1} isLast={false} icon={ListChecks} title={t('onboardingStep1Title')} body={t('onboardingStep1Body')} />
          <Step index={2} isLast={false} icon={MousePointerClick} title={t('onboardingStep2Title')} body={t('onboardingStep2Body')} />
          <Step index={3} isLast={true} icon={Save} title={t('onboardingStep3Title')} body={t('onboardingStep3Body')} />
        </div>

        <div
          className="flex animate-fade-up items-start gap-3 rounded-lg border border-border bg-muted/40 p-4"
          style={{ animationDelay: '280ms' }}
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          <p className="text-xs text-muted-foreground">{t('privacyNote')}</p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '340ms' }}>
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">{t('onboardingPickPlatform')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {enabledAdapters.map((adapter) => {
              const Icon = PLATFORM_ICONS[adapter.id]
              return (
                <Button
                  key={adapter.id}
                  variant="outline"
                  className="gap-2 transition-transform duration-200 ease-emphasized hover:-translate-y-0.5"
                  onClick={() => void chrome.tabs.create({ url: platformHomeUrl(adapter.id) }).catch(() => undefined)}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${PLATFORM_ICON_CLASSES[adapter.id]}`} />
                  {adapter.label}
                </Button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function Onboarding() {
  return (
    <ThemeProvider>
      <OnboardingContent />
    </ThemeProvider>
  )
}
