import type { CSSProperties } from 'react'
import { useState } from 'react'
import { freqLabel, getFrequency, journeyDescription, journeyTitle, purposeKey } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { THEME_HUE, hueFill, hueGlow, hueText, journeysByTheme, themeBlurbKey, themeKey, type JourneyTheme } from '../lib/themes'
import type { Journey } from '../lib/types'
import { useJourneys } from '../store/journeyStore'
import { Screen } from './ui'
import { journeyCover } from '../lib/cover'

function JourneyCard({ journey, hue }: { journey: Journey; hue: number }) {
  const { t, lang } = useT()
  const progress = useJourneys((s) => s.progress)
  const p = progress[journey.id]
  const done = p?.completedDays.length ?? 0
  const pct = Math.round((done / journey.days) * 100)
  const complete = done >= journey.days

  return (
    <button
      onClick={() => navigate(`/journey/${journey.id}`)}
      className="flex w-full items-start gap-3 rounded-[12px] p-2 text-start transition-colors duration-200"
    >
      {/* The cover, with the length stamped on it — a badge on artwork is one
          glance instead of two, and it leaves the row for the words. */}
      <span className="relative shrink-0">
        <img
          src={journeyCover(journey)}
          alt=""
          className="h-16 w-16 rounded-[9px] object-cover"
          style={{ boxShadow: '0 8px 20px -10px rgba(0,0,0,0.7)' }}
        />
        <span
          className="absolute bottom-1 end-1 rounded-full px-1.5 py-px text-[10px] font-bold leading-tight"
          style={{ background: 'rgba(0,0,0,0.72)', color: '#fff' }}
        >
          <span className="readout">{journey.days}</span>
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold">{journeyTitle(journey, lang)}</span>
          <span
            className="rounded-full px-2 py-[3px] text-[10px] font-semibold leading-none"
            style={{ background: hueFill(hue, 0.16), color: hueText(hue) }}
          >
            {t(purposeKey(journey.purpose))}
          </span>
          {journey.arc && (
            <span
              className="txt-3 text-[10px]"
              title={t(journey.arc === 'ascending' ? 'journeys.ascending' : 'journeys.descending')}
            >
              {journey.arc === 'ascending' ? '↑' : '↓'}
            </span>
          )}
          {complete && <span className="chip">{t('common.done')}</span>}
        </span>

        <span className="txt-2 mt-1 block text-[12px] leading-relaxed">
          {journeyDescription(journey, lang)}
        </span>

        {p ? (
          <span className="mt-2 flex items-center gap-2">
            <span
              className="meter h-1.5 flex-1 overflow-hidden rounded-[1px]"
              style={{ background: 'var(--border)', '--segments': journey.days } as CSSProperties}
            >
              <span
                className="block h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, hsl(${hue} 92% 62%), hsl(${hue + 40} 90% 62%))`,
                  boxShadow: `0 0 12px ${hueGlow(hue, 0.5)}`,
                }}
              />
            </span>
            <span className="txt-3 readout text-[11px]">
              {done}/{journey.days}
            </span>
          </span>
        ) : (
          <span className="txt-3 mt-1.5 block text-[11px]">
            {t('journeys.startsWith')}
            {(() => {
              const first = getFrequency(journey.schedule[0].frequencyId)
              return first ? freqLabel(first, lang) : '—'
            })()}{' '}
            · <span className="readout">{journey.schedule[0].durationMin}</span> {t('common.min')}
          </span>
        )}
      </span>
    </button>
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
              className="shrink-0 rounded-full px-4 py-2.5 text-[13px] font-bold leading-none transition-all active:scale-95"
              style={{
                background: active
                  ? hue === null
                    ? 'var(--accent-soft)'
                    : hueFill(hue, 0.16)
                  : 'var(--pill-quiet-bg)',
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
                  boxShadow: `0 0 10px ${hueGlow(THEME_HUE[group.theme], 0.7)}`,
                }}
                aria-hidden
              />
              <h2 className="text-sm font-bold">{t(themeKey(group.theme))}</h2>
              <span className="txt-3 truncate text-[11px]">{t(themeBlurbKey(group.theme))}</span>
            </div>
            <div className="-mx-1">
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
