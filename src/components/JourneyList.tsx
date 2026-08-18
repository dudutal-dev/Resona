import type { CSSProperties } from 'react'
import { useState } from 'react'
import { freqLabel, getFrequency, journeyDescription, journeyTitle, purposeKey } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { THEME_HUE, hueText, journeysByTheme, themeBlurbKey, themeKey, type JourneyTheme } from '../lib/themes'
import type { Journey } from '../lib/types'
import { useJourneys } from '../store/journeyStore'
import { Card, Screen } from './ui'

function JourneyCard({ journey, hue }: { journey: Journey; hue: number }) {
  const { t, lang } = useT()
  const progress = useJourneys((s) => s.progress)
  const p = progress[journey.id]
  const done = p?.completedDays.length ?? 0
  const pct = Math.round((done / journey.days) * 100)
  const complete = done >= journey.days

  return (
    <Card glow={!!p} onClick={() => navigate(`/journey/${journey.id}`)}>
      <div className="flex items-start gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
          style={{
            background: `hsl(${hue} 85% 62% / 0.16)`,
            border: `1px solid hsl(${hue} 85% 65% / 0.4)`,
            color: hueText(hue),
          }}
        >
          <span className="readout text-lg font-bold leading-none">{journey.days}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{journeyTitle(journey, lang)}</h3>
            <span
              className="rounded-[3px] px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: `hsl(${hue} 85% 62% / 0.14)`,
                color: hueText(hue),
                border: `1px solid hsl(${hue} 85% 65% / 0.32)`,
              }}
            >
              {t(purposeKey(journey.purpose))}
            </span>
            {journey.arc && (
              <span className="txt-3 text-[10px]" title={t(journey.arc === 'ascending' ? 'journeys.ascending' : 'journeys.descending')}>
                {journey.arc === 'ascending' ? '↑' : '↓'}
              </span>
            )}
            {complete && <span className="chip">{t('common.done')}</span>}
          </div>
          <p className="txt-2 mt-1 text-xs leading-relaxed">{journeyDescription(journey, lang)}</p>

          {p ? (
            <div className="mt-3 flex items-center gap-2">
              <div
                className="meter h-1.5 flex-1 overflow-hidden rounded-[1px]"
                style={{ background: 'var(--border)', '--segments': journey.days } as CSSProperties}
              >
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, hsl(${hue} 92% 62%), hsl(${hue + 40} 90% 62%))`,
                    boxShadow: `0 0 12px hsl(${hue} 90% 60% / 0.5)`,
                  }}
                />
              </div>
              <span className="txt-3 readout text-[11px]">
                {done}/{journey.days}
              </span>
            </div>
          ) : (
            <p className="txt-3 mt-2 text-[11px]">
              {t('journeys.startsWith')}
              {(() => {
                const first = getFrequency(journey.schedule[0].frequencyId)
                return first ? freqLabel(first, lang) : '—'
              })()}{' '}
              · <span className="readout">{journey.schedule[0].durationMin}</span> {t('common.min')}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

export function JourneyList() {
  const { t, rich } = useT()
  const [filter, setFilter] = useState<JourneyTheme | 'all'>('all')
  const groups = journeysByTheme()
  const shown = filter === 'all' ? groups : groups.filter((g) => g.theme === filter)
  const total = groups.reduce((n, g) => n + g.journeys.length, 0)

  return (
    <Screen title={t('journeys.title')} subtitle={t('journeys.subtitle', { n: total })} onBack>
      {/* The shelves are few and fixed, so they sit in the open as a scroll
          strip — a dropdown would hide the whole taxonomy behind a tap. */}
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ theme: 'all' as const }, ...groups].map((g) => {
          const isAll = g.theme === 'all'
          const active = filter === g.theme
          const hue = isAll ? null : THEME_HUE[g.theme]
          const count = isAll ? total : groups.find((x) => x.theme === g.theme)!.journeys.length
          return (
            <button
              key={g.theme}
              onClick={() => setFilter(g.theme)}
              aria-pressed={active}
              className="shrink-0 rounded-[4px] px-4 py-2 text-xs font-semibold transition-all active:scale-95"
              style={{
                background: active
                  ? hue === null
                    ? 'var(--accent-soft)'
                    : `hsl(${hue} 85% 62% / 0.18)`
                  : 'var(--card)',
                border: `1px solid ${
                  active
                    ? hue === null
                      ? 'var(--accent-line)'
                      : `hsl(${hue} 85% 65% / 0.45)`
                    : 'var(--border)'
                }`,
                color: active
                  ? hue === null
                    ? 'var(--accent)'
                    : hueText(hue)
                  : 'var(--txt-2)',
              }}
            >
              {isAll ? t('journeys.all') : t(themeKey(g.theme))} · <span className="readout">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-7">
        {shown.map((group) => (
          <section key={group.theme}>
            <div className="mb-2 flex items-baseline gap-2 px-1">
              <span
                className="h-2 w-2 shrink-0 self-center rounded-full"
                style={{
                  background: `hsl(${THEME_HUE[group.theme]} 90% 62%)`,
                  boxShadow: `0 0 10px hsl(${THEME_HUE[group.theme]} 90% 60% / 0.7)`,
                }}
                aria-hidden
              />
              <h2 className="text-sm font-bold">{t(themeKey(group.theme))}</h2>
              <span className="txt-3 truncate text-[11px]">{t(themeBlurbKey(group.theme))}</span>
            </div>
            <div className="space-y-2">
              {group.journeys.map((journey) => (
                <JourneyCard key={journey.id} journey={journey} hue={THEME_HUE[group.theme]} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="txt-3 mt-6 px-1 text-[11px] leading-relaxed">
        {rich('journeys.footer')}
      </p>
    </Screen>
  )
}
