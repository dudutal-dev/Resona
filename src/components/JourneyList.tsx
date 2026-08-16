import { useState } from 'react'
import { PURPOSE_LABEL, getFrequency } from '../lib/catalog'
import { navigate } from '../lib/router'
import {
  THEME_BLURB,
  THEME_HUE,
  THEME_LABEL,
  journeysByTheme,
  type JourneyTheme,
} from '../lib/themes'
import type { Journey } from '../lib/types'
import { useJourneys } from '../store/journeyStore'
import { Card, Screen } from './ui'

function JourneyCard({ journey, hue }: { journey: Journey; hue: number }) {
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
            color: `hsl(${hue} 90% 72%)`,
          }}
        >
          <span className="ltr text-lg font-bold leading-none">{journey.days}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{journey.title}</h3>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: `hsl(${hue} 85% 62% / 0.14)`,
                color: `hsl(${hue} 90% 72%)`,
                border: `1px solid hsl(${hue} 85% 65% / 0.32)`,
              }}
            >
              {PURPOSE_LABEL[journey.purpose]}
            </span>
            {journey.arc && (
              <span className="txt-3 text-[10px]" title={journey.arc === 'ascending' ? 'עולה בסולם' : 'יורד בסולם'}>
                {journey.arc === 'ascending' ? '↑' : '↓'}
              </span>
            )}
            {complete && <span className="chip">הושלם ✓</span>}
          </div>
          <p className="txt-2 mt-1 text-xs leading-relaxed">{journey.description}</p>

          {p ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, hsl(${hue} 92% 62%), hsl(${hue + 40} 90% 62%))`,
                    boxShadow: `0 0 12px hsl(${hue} 90% 60% / 0.5)`,
                  }}
                />
              </div>
              <span className="txt-3 ltr text-[11px] tabular-nums">
                {done}/{journey.days}
              </span>
            </div>
          ) : (
            <p className="txt-3 mt-2 text-[11px]">
              מתחיל ב־
              {getFrequency(journey.schedule[0].frequencyId)?.label ?? '—'} ·{' '}
              <span className="ltr">{journey.schedule[0].durationMin} דק׳</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

export function JourneyList() {
  const [filter, setFilter] = useState<JourneyTheme | 'all'>('all')
  const groups = journeysByTheme()
  const shown = filter === 'all' ? groups : groups.filter((g) => g.theme === filter)
  const total = groups.reduce((n, g) => n + g.journeys.length, 0)

  return (
    <Screen title="מסעות" subtitle={`${total} תוכניות, מקובצות לפי נושא`} onBack>
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
              className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95"
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
                    : `hsl(${hue} 90% 74%)`
                  : 'var(--txt-2)',
              }}
            >
              {isAll ? 'הכול' : THEME_LABEL[g.theme]} · <span className="ltr">{count}</span>
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
              <h2 className="text-sm font-bold">{THEME_LABEL[group.theme]}</h2>
              <span className="txt-3 truncate text-[11px]">{THEME_BLURB[group.theme]}</span>
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
        המסעות הם מבנה האזנה מוצע, לא פרוטוקול טיפולי. אפשר לדלג בין ימים בכל שלב, ואפשר להוסיף
        מסעות משלך בקובץ <span className="ltr">src/data/journeys.json</span>.
      </p>
    </Screen>
  )
}
