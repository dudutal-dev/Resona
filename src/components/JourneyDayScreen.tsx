import { useState } from 'react'
import {
  dayNote,
  freqLabel,
  getFrequency,
  getJourney,
  journeyTitle,
  freqInfo,
  shortLabel,
  trustNoticeKey,
} from '../lib/catalog'
import { useT } from '../lib/i18n'
import { bandForDay, configForDay } from '../lib/journeyConfig'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { useJourneys } from '../store/journeyStore'
import type { MoodScore } from '../lib/types'
import { Card, Screen, TrustBadge } from './ui'
import { MoodPicker } from './MoodPicker'
import { ListeningMode } from './ListeningMode'
import { InfoPanel } from './InfoPanel'

export function JourneyDayScreen({ id, day }: { id: string; day: number }) {
  const { t, lang } = useT()
  const journey = getJourney(id)
  const entry = journey?.schedule.find((d) => d.day === day)
  const { loadConfig, config } = useSession()
  const { progress, start, completeDay, setMood } = useJourneys()
  const [infoOpen, setInfoOpen] = useState(false)

  if (!journey || !entry) {
    return (
      <Screen title={t('day.notFound')} onBack>
        <p className="txt-2 text-sm">{t('day.notFoundBody')}</p>
      </Screen>
    )
  }

  const freq = getFrequency(entry.frequencyId)
  const band = bandForDay(entry, journey)
  const bandIsSubject = !!freq?.range
  /**
   * The rate this night will actually run at. Worth showing rather than the
   * band's range: a sleep journey's whole content is descending through delta,
   * and every night of it reads "0.5–4 Hz" if the range is what gets printed.
   */
  const beatHz = configForDay(entry, journey).beatHz
  const p = progress[journey.id]
  const isDone = p?.completedDays.includes(day) ?? false
  const mood = p?.dailyMood?.[day]

  const handleStart = () => {
    start(journey.id)
    loadConfig(configForDay(entry, journey, config), { journeyId: journey.id, day })
    navigate('/player')
  }

  const handleMood = (score: MoodScore) => {
    if (isDone) setMood(journey.id, day, score)
    else completeDay(journey.id, day, score)
  }

  return (
    <Screen title={t('common.dayN', { n: day })} subtitle={journeyTitle(journey, lang)} onBack>
      <Card glow className="mb-5 text-center">
        <div
          className="mx-auto grid h-24 w-24 place-items-center rounded-3xl"
          style={{
            background: `hsl(${freq?.hue ?? 265} 85% 62% / 0.16)`,
            border: `1px solid hsl(${freq?.hue ?? 265} 85% 65% / 0.45)`,
            boxShadow: `0 0 50px hsl(${freq?.hue ?? 265} 90% 60% / 0.35)`,
          }}
        >
          <div>
            <div
              className="readout text-2xl font-bold leading-none"
              style={{ color: `hsl(${freq?.hue ?? 265} 92% 76%)` }}
            >
              {freq?.hz ?? beatHz}
            </div>
            <div className="txt-3 readout mt-1 text-[10px] font-semibold">Hz</div>
          </div>
        </div>

        <h2 className="mt-4 text-xl font-bold">{freq ? freqLabel(freq, lang) : ''}</h2>
        <p className="txt-2 mt-1 text-sm">{dayNote(entry, lang)}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="chip">
            {`${entry.durationMin} ${t('common.minutes')}`}
          </span>
          {freq && <TrustBadge trust={freq.trust} />}
          {isDone && <span className="chip">{t('common.done')}</span>}
        </div>

        {band && !bandIsSubject && (
          <p className="txt-3 mt-3 text-[11px] leading-relaxed">
            {t('day.supporting')}
            <span className="font-semibold" style={{ color: 'var(--accent)' }}>
              {shortLabel(band, lang)}
            </span>{' '}
            <span className="readout">({beatHz} Hz)</span>
            {t('day.supportingTail')}
          </p>
        )}

        <div className="mt-5 text-start">
          <ListeningMode compact hasBeatLayer />
        </div>

        <button onClick={handleStart} className="btn btn-primary mt-4 w-full">
          {isDone ? t('day.again') : t('day.start')}
        </button>
        <button onClick={() => setInfoOpen(true)} className="btn btn-ghost mt-2 w-full text-xs txt-3">
          {t('day.whatIsClaimed')}
        </button>
      </Card>

      {freq && (
        <div className="glass mb-5 rounded-3xl p-4">
          <p className="txt-2 text-sm leading-relaxed">{freqInfo(freq, lang)}</p>
          <p className="txt-3 mt-2 text-[11px] leading-relaxed">{t(trustNoticeKey(freq.trust))}</p>
        </div>
      )}

      <div className="glass rounded-3xl p-4">
        <h3 className="mb-1 text-sm font-bold">{t('day.howDidYouFeel')}</h3>
        <p className="txt-3 mb-3 text-[11px]">
          {isDone
            ? t('day.moodDone')
            : t('day.moodNew')}
        </p>
        <MoodPicker value={mood} onPick={handleMood} />
      </div>

      <InfoPanel freq={freq ?? null} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </Screen>
  )
}
