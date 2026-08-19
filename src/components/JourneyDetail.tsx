import type { CSSProperties } from 'react'
import {
  dayNote,
  freqLabel,
  getFrequency,
  getJourney,
  journeyDescription,
  journeyTitle,
  purposeKey,
  shortLabel,
} from '../lib/catalog'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { bandForDay, configForDay } from '../lib/journeyConfig'
import { hueText } from '../lib/themes'
import { useJourneys } from '../store/journeyStore'
import { useCustomJourneys } from '../store/customJourneyStore'
import { Screen, TrustBadge } from './ui'
import { FavouriteButton } from './FavouriteButton'
import { ReleaseHeader } from './ReleaseHeader'
import { journeyCover } from '../lib/cover'

const MOOD_FACE: Record<number, string> = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😌' }

export function JourneyDetail({ id }: { id: string }) {
  const { t, lang } = useT()
  const journey = getJourney(id)
  const { progress, start, reset } = useJourneys()
  const removeCustom = useCustomJourneys((s) => s.remove)
  const built = useCustomJourneys((s) => s.journeys.some((j) => j.id === id))

  if (!journey) {
    return (
      <Screen title={t('journey.notFound')} onBack>
        <p className="txt-2 text-sm">{t('journey.notFoundBody')}</p>
      </Screen>
    )
  }

  const p = progress[journey.id]
  const done = p?.completedDays.length ?? 0
  const pct = Math.round((done / journey.days) * 100)
  const complete = done >= journey.days

  const handleStart = () => {
    start(journey.id)
    const target = p?.currentDay ?? 1
    navigate(`/journey/${journey.id}/day/${target}`)
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden px-4 pb-40 safe-top">
      <ReleaseHeader
        cover={journeyCover(journey)}
        menu={<FavouriteButton journeyId={journey.id} size={22} />}
        eyebrow={t(purposeKey(journey.purpose))}
        title={journeyTitle(journey, lang)}
        subtitle={t('journey.byline', { n: journey.days })}
        meta={
          <>
            <span className="readout">
              {done}/{journey.days}
            </span>
            {journey.arc && (
              <>
                <span aria-hidden>·</span>
                <span>
                  {t(journey.arc === 'ascending' ? 'journey.ascendingMark' : 'journey.descendingMark')}
                </span>
              </>
            )}
          </>
        }
        primary={{
          label: complete
            ? t('journey.listenAgain')
            : p
              ? t('journey.continue', { n: p.currentDay })
              : t('journey.start'),
          onClick: handleStart,
          icon: (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
            </svg>
          ),
        }}
        secondary={
          p
            ? {
                label: t('journey.reset'),
                onClick: () => {
                  if (confirm(t('journey.resetConfirm'))) reset(journey.id)
                },
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.4L4 9"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M4 4v5h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              }
            : undefined
        }
      />

      {/* One line per day, the way a release lists its tracks. */}
      <p className="txt-2 mt-8 text-[13px] leading-relaxed">{journeyDescription(journey, lang)}</p>

      <div className="mt-4 flex items-center gap-2">
        <div
          className="meter h-1.5 flex-1 overflow-hidden rounded-[1px]"
          style={{ background: 'var(--border)', '--segments': journey.days } as CSSProperties}
        >
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, hsl(var(--h) 92% 62%), hsl(calc(var(--h) + 40) 90% 60%))',
              boxShadow: '0 0 14px var(--glow)',
            }}
          />
        </div>
        <span className="txt-2 readout text-xs font-semibold">
          {done}/{journey.days}
        </span>
      </div>

      {/* Day list */}
      <div className="mt-4 -mx-1">
        {journey.schedule.map((day) => {
          const freq = getFrequency(day.frequencyId)
          const band = bandForDay(day, journey)
          // The rate the night runs at, not the band's range — see JourneyDayScreen.
          const beatHz = configForDay(day, journey).beatHz
          const isDone = p?.completedDays.includes(day.day) ?? false
          const isCurrent = !isDone && (p?.currentDay ?? 1) === day.day
          const mood = p?.dailyMood?.[day.day]

          return (
            <button
              key={day.day}
              onClick={() => navigate(`/journey/${journey.id}/day/${day.day}`)}
              className={`flex w-full items-center gap-3 rounded-[10px] px-1 py-2.5 text-start transition-colors active:bg-[var(--card)] ${
                isDone ? 'opacity-55' : ''
              }`}
            >
              <span
                className="grid h-10 w-8 shrink-0 place-items-center text-[13px] font-bold"
                style={{ color: isCurrent ? 'var(--accent)' : hueText(freq?.hue ?? 265) }}
              >
                {isDone ? '✓' : <span className="readout">{day.day}</span>}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[14px] font-bold">
                    {freq ? freqLabel(freq, lang) : day.frequencyId}
                  </span>
                  {isCurrent && <span className="chip">{t('journey.today')}</span>}
                  {mood && <span className="text-sm leading-none">{MOOD_FACE[mood]}</span>}
                </span>
                <span className="txt-3 mt-0.5 block truncate text-[11px]">
                  <span className="ltr">
                    <span className="readout">{freq?.hz ? `${freq.hz} Hz` : `${beatHz} Hz`}</span> ·{' '}
                    <span className="readout">{day.durationMin}</span> {t('common.min')}
                  </span>{' '}
                  · {dayNote(day, lang)}
                  {band && !freq?.range && (
                    <>
                      {' '}
                      · + {shortLabel(band, lang)} <span className="readout">{beatHz} Hz</span>
                    </>
                  )}
                </span>
              </span>

              {freq && <TrustBadge trust={freq.trust} />}
            </button>
          )
        })}
      </div>

      {/* Only a built journey can be deleted — the catalogue is not the
          person's to remove, and a week they composed accumulates otherwise. */}
      {built && (
        <button
          onClick={() => {
            if (!confirm(t('build.deleteConfirm'))) return
            reset(journey.id)
            removeCustom(journey.id)
            navigate('/journeys')
          }}
          className="txt-3 mt-6 w-full py-3 text-center text-[12px] font-semibold underline underline-offset-4"
        >
          {t('build.delete')}
        </button>
      )}
    </div>
  )
}
