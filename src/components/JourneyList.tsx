import { useState } from 'react'
import { journeyDescription, journeyTitle } from '../lib/catalog'
import { GLYPH_FOR_THEME, Glyph } from '../lib/glyphs'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import {
  THEME_HUE,
  hueFill,
  hueText,
  journeysByTheme,
  themeKey,
  themeOf,
  type JourneyTheme,
} from '../lib/themes'
import type { Journey } from '../lib/types'
import { useJourneys } from '../store/journeyStore'
import { AppBar, SectionHead } from './AppBar'

/**
 * A journey, as a plate rather than a row.
 *
 * The list this replaced was a stack of thumbnails and two lines of type — a
 * playlist, in other words, and a journey is not one. It is a week of evenings
 * with a direction, and the card has to say that before it says anything else:
 * the whole surface is filled in the shelf's colour, the days lie along the
 * bottom as segments you can count, and the mark in the corner is the same one
 * the shelf carries everywhere.
 *
 * All the type on it is white in every theme, because the card is saturated in
 * every theme. That is the one place in the app where the colour is the ground
 * rather than the accent.
 */
function JourneyCard({ journey }: { journey: Journey }) {
  const { t, lang } = useT()
  const progress = useJourneys((s) => s.progress)
  const done = progress[journey.id]?.completedDays.length ?? 0
  const theme = themeOf(journey)
  const hue = THEME_HUE[theme]
  const first = journey.schedule[0]

  return (
    <button
      onClick={() => navigate(`/journey/${journey.id}`)}
      className="jcard w-full p-4 text-start"
      style={{
        background: `linear-gradient(152deg, hsl(${hue} var(--jc-s1) var(--jc-l1)), hsl(${hue + 32} var(--jc-s2) var(--jc-l2)))`,
        color: '#fff',
      }}
    >
      {/* The shelf's mark, big and barely there — texture, not an icon. */}
      <span
        className="pointer-events-none absolute end-4 top-4"
        style={{ color: 'rgba(255,255,255,0.34)' }}
        aria-hidden
      >
        <Glyph id={GLYPH_FOR_THEME[theme]} size={31} />
      </span>

      <h3 className="pe-11 text-[18px] font-extrabold leading-tight">{journeyTitle(journey, lang)}</h3>

      <p className="mt-1.5 text-[11.5px] font-bold" style={{ color: 'rgba(255,255,255,0.82)' }}>
        {t('common.daysN', { n: journey.days })}
        {' · '}
        <span className="readout">{first.durationMin}</span> {t('common.minutes')}
        {' · ♬ '}
        {t('journeys.withMelody')}
      </p>

      <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.86)' }}>
        {journeyDescription(journey, lang)}
      </p>

      {/* One bar per day. Counting them is how you know what you are agreeing to. */}
      <span className="mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: journey.days }, (_, i) => (
          <span key={i} className="seg" data-done={i < done} />
        ))}
      </span>
    </button>
  )
}

export function JourneyList() {
  const { t, rich } = useT()
  const [filter, setFilter] = useState<JourneyTheme | 'all'>('all')
  const groups = journeysByTheme()
  const shown = filter === 'all' ? groups : groups.filter((g) => g.theme === filter)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 safe-top">
      <AppBar title={t('journeys.title')} />

      <SectionHead title={t('journeys.guided')} blurb={t('journeys.guidedBlurb')} tight />

      {/* The one thing here that is made rather than chosen. */}
      <button onClick={() => navigate('/build')} className="obj mb-5 flex w-full items-center gap-3 p-3.5 text-start">
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-extrabold">{t('build.entry')}</span>
          <span className="txt-3 mt-0.5 block text-[11.5px]">{t('build.entryNote')}</span>
        </span>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--gold-soft)', color: 'var(--gold)', border: '1px solid var(--gold)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      </button>

      {/* Shelf filter. Chips rather than a menu: there are eight of them and the
          count on each is half the reason to tap it. */}
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['all', ...groups.map((g) => g.theme)] as const).map((key) => {
          const active = filter === key
          const hue = key === 'all' ? null : THEME_HUE[key as JourneyTheme]
          const count =
            key === 'all'
              ? groups.reduce((n, g) => n + g.journeys.length, 0)
              : (groups.find((g) => g.theme === key)?.journeys.length ?? 0)
          return (
            <button
              key={key}
              onClick={() => setFilter(key as JourneyTheme | 'all')}
              className="shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-colors"
              style={{
                background: active
                  ? hue === null
                    ? 'var(--gold-soft)'
                    : hueFill(hue, 0.2)
                  : 'var(--obj)',
                border: `1px solid ${active ? (hue === null ? 'var(--gold)' : hueText(hue)) : 'var(--obj-line)'}`,
                color: active ? (hue === null ? 'var(--gold)' : hueText(hue)) : 'var(--txt-3)',
              }}
            >
              {key === 'all' ? t('journeys.all') : t(themeKey(key as JourneyTheme))}{' '}
              <span className="readout">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        {shown.flatMap((g) => g.journeys).map((journey) => (
          <JourneyCard key={journey.id} journey={journey} />
        ))}
      </div>

      <p className="txt-3 mt-8 px-1 text-[11px] leading-relaxed">{rich('journeys.footer')}</p>
    </div>
  )
}
