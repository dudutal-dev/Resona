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
import { hueFill, hueLine, hueText } from '../lib/themes'
import { useJourneys } from '../store/journeyStore'
import { Card, Screen, TrustBadge } from './ui'

const MOOD_FACE: Record<number, string> = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😌' }

export function JourneyDetail({ id }: { id: string }) {
  const { t, lang } = useT()
  const journey = getJourney(id)
  const { progress, start, reset } = useJourneys()

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
    <Screen title={journeyTitle(journey, lang)} subtitle={journeyDescription(journey, lang)} onBack>
      {/* Progress header */}
      <Card glow className="mb-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="chip">{t(purposeKey(journey.purpose))}</span>
              {journey.arc && (
                <span className="chip">
                  {t(journey.arc === 'ascending' ? 'journey.ascendingMark' : 'journey.descendingMark')}
                </span>
              )}
              <span className="txt-3 text-[11px]">{t('common.daysN', { n: journey.days })}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div
                className="meter h-2 flex-1 overflow-hidden rounded-[1px]"
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
          </div>
        </div>
        <button onClick={handleStart} className="btn btn-primary mt-4 w-full">
          {complete
            ? t('journey.listenAgain')
            : p
              ? t('journey.continue', { n: p.currentDay })
              : t('journey.start')}
        </button>
        {p && (
          <button
            onClick={() => {
              if (confirm(t('journey.resetConfirm'))) reset(journey.id)
            }}
            className="btn btn-ghost mt-2 w-full text-xs txt-3"
          >
            {t('journey.reset')}
          </button>
        )}
      </Card>

      {/* Day list */}
      <div className="space-y-2">
        {journey.schedule.map((day) => {
          const freq = getFrequency(day.frequencyId)
          const band = bandForDay(day, journey)
          // The rate the night runs at, not the band's range — see JourneyDayScreen.
          const beatHz = configForDay(day, journey).beatHz
          const isDone = p?.completedDays.includes(day.day) ?? false
          const isCurrent = !isDone && (p?.currentDay ?? 1) === day.day
          const mood = p?.dailyMood?.[day.day]

          return (
            <Card
              key={day.day}
              glow={isCurrent}
              onClick={() => navigate(`/journey/${journey.id}/day/${day.day}`)}
              className={isDone ? 'opacity-70' : ''}
            >
              <div className="flex items-center gap-3">
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold"
                  style={{
                    background: isDone ? 'var(--accent-soft)' : hueFill(freq?.hue ?? 265, 0.14),
                    border: `1px solid ${isDone ? 'var(--accent-line)' : hueLine(freq?.hue ?? 265, 0.35)}`,
                    color: isDone ? 'var(--accent)' : hueText(freq?.hue ?? 265),
                  }}
                >
                  {isDone ? '✓' : <span className="readout">{day.day}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{freq ? freqLabel(freq, lang) : day.frequencyId}</p>
                    {isCurrent && <span className="chip">{t('journey.today')}</span>}
                    {mood && <span className="text-sm leading-none">{MOOD_FACE[mood]}</span>}
                  </div>
                  <p className="txt-3 mt-0.5 text-[11px]">
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
                  </p>
                </div>

                {freq && <TrustBadge trust={freq.trust} />}
              </div>
            </Card>
          )
        })}
      </div>
    </Screen>
  )
}
