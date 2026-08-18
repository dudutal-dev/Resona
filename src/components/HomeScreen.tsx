import {
  BEAT_FREQUENCIES,
  JOURNEYS,
  ROOT_FREQUENCIES,
  freqLabel,
  getFrequency,
  getJourney,
  journeyTitle,
} from '../lib/catalog'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { usePresets } from '../store/presetsStore'
import { useJourneys } from '../store/journeyStore'
import { Card, formatClock } from './ui'
import { HistoryPanel } from './HistoryPanel'

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="flip-ltr shrink-0 txt-3">
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function HomeScreen() {
  const { t, rich, lang } = useT()
  const { config, isPlaying, elapsed } = useSession()
  const presets = usePresets((s) => s.presets)
  const progress = useJourneys((s) => s.progress)

  const root = getFrequency(config.rootId)
  const inProgress = Object.values(progress)
    .map((p) => ({ p, journey: getJourney(p.journeyId) }))
    .filter((x) => x.journey && x.p.completedDays.length < x.journey.days)

  const hour = new Date().getHours()
  const greeting =
    hour < 5
      ? 'home.greet.night'
      : hour < 12
        ? 'home.greet.morning'
        : hour < 18
          ? 'home.greet.afternoon'
          : 'home.greet.evening'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 safe-top">
      <header className="pb-7 pt-6">
        <p className="txt-3 text-sm font-medium">{t(greeting)}</p>
        <h1 className="glow-text mt-1 text-4xl font-bold tracking-tight sm:text-5xl">Resona</h1>
        <p className="txt-2 mt-2 max-w-md text-sm leading-relaxed">
          {rich('home.tagline')}
        </p>
      </header>

      {/* Continue listening */}
      <Card glow onClick={() => navigate('/player')} className="mb-4">
        <div className="flex items-center gap-4">
          <div
            className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl"
            style={{
              background: `hsl(${root?.hue ?? 265} 85% 62% / 0.18)`,
              border: `1px solid hsl(${root?.hue ?? 265} 85% 65% / 0.45)`,
              boxShadow: `0 0 32px hsl(${root?.hue ?? 265} 90% 60% / 0.35)`,
            }}
          >
            {isPlaying && (
              <span
                className="absolute inset-0 animate-pulse-ring rounded-2xl"
                style={{ border: '1.5px solid hsl(var(--h) 95% 70% / 0.5)' }}
                aria-hidden
              />
            )}
            <span className="ltr text-sm font-bold" style={{ color: `hsl(${root?.hue ?? 265} 90% 75%)` }}>
              {root?.hz}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="txt-3 text-[11px] font-semibold uppercase tracking-wider">
              {t(isPlaying ? 'home.nowPlaying' : 'home.continue')}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold">{root ? freqLabel(root, lang) : ''}</p>
            <p className="txt-2 ltr mt-0.5 text-xs tabular-nums">
              {isPlaying ? formatClock(elapsed) : `${root?.hz} Hz`}
            </p>
          </div>
          <ArrowIcon />
        </div>
      </Card>

      {/* Journey in progress */}
      {inProgress.length > 0 && (
        <div className="mb-4 space-y-2">
          {inProgress.map(({ p, journey }) => {
            const pct = Math.round((p.completedDays.length / journey!.days) * 100)
            return (
              <Card key={p.journeyId} onClick={() => navigate(`/journey/${p.journeyId}`)}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="txt-3 text-[11px] font-semibold uppercase tracking-wider">{t('home.activeJourney')}</p>
                    <p className="mt-0.5 truncate text-base font-bold">{journeyTitle(journey!, lang)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, hsl(var(--h) 92% 62%), hsl(calc(var(--h) + 40) 90% 60%))',
                            boxShadow: '0 0 12px var(--glow)',
                          }}
                        />
                      </div>
                      <span className="txt-3 ltr text-[11px] tabular-nums">
                        {p.completedDays.length}/{journey!.days}
                      </span>
                    </div>
                  </div>
                  <ArrowIcon />
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Quick tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => navigate('/journeys')} className="!p-5">
          <div
            className="mb-3 grid h-11 w-11 place-items-center rounded-2xl"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }} aria-hidden>
              <path d="M4 6h16M4 12h10M4 18h13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="18.5" cy="12" r="2" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <p className="text-base font-bold">{t('home.myJourneys')}</p>
          <p className="txt-3 mt-0.5 text-xs">{t('home.journeyCount', { n: JOURNEYS.length })}</p>
        </Card>

        <Card onClick={() => navigate('/presets')} className="!p-5">
          <div
            className="mb-3 grid h-11 w-11 place-items-center rounded-2xl"
            style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }} aria-hidden>
              <path d="M5 4v16M12 4v16M19 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="5" cy="9" r="2.2" fill="currentColor" />
              <circle cx="12" cy="15" r="2.2" fill="currentColor" />
              <circle cx="19" cy="8" r="2.2" fill="currentColor" />
            </svg>
          </div>
          <p className="text-base font-bold">{t('home.myPresets')}</p>
          <p className="txt-3 mt-0.5 text-xs">
            {presets.length ? t('home.presetCount', { n: presets.length }) : t('home.noPresets')}
          </p>
        </Card>

        <Card onClick={() => navigate('/frequencies')} className="col-span-2 !p-5">
          <div className="flex items-center gap-4">
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
              style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent)' }} aria-hidden>
                <path
                  d="M3 12h2l2-7 3 14 3-17 3 13 2-3h3"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">{t('home.browse')}</p>
              <p className="txt-3 mt-0.5 text-xs">
                {rich('home.browseSub', {
                  roots: ROOT_FREQUENCIES.length,
                  bands: BEAT_FREQUENCIES.length,
                })}
              </p>
            </div>
            <ArrowIcon />
          </div>
        </Card>
      </div>

      {/* Below the ways in, because it is a record rather than a destination. */}
      <div className="mt-4">
        <HistoryPanel />
      </div>

      <p className="txt-3 mt-6 px-1 text-[11px] leading-relaxed">
        {t('home.disclaimer')}
      </p>
    </div>
  )
}
