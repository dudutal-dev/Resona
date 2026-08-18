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
import { Screen, TrustBadge } from './ui'
import { ReleaseHeader } from './ReleaseHeader'
import { coverForRoot } from '../lib/cover'
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
    <div className="mx-auto w-full max-w-3xl overflow-hidden px-4 pb-40 safe-top">
      <ReleaseHeader
        cover={coverForRoot(entry.frequencyId)}
        eyebrow={`${journeyTitle(journey, lang)} · ${t('common.dayN', { n: day })}`}
        title={freq ? freqLabel(freq, lang) : t('common.dayN', { n: day })}
        subtitle={dayNote(entry, lang)}
        meta={
          <>
            <span className="chip">
              <span className="readout">{freq?.hz ?? beatHz}</span> Hz
            </span>
            <span className="chip">{`${entry.durationMin} ${t('common.minutes')}`}</span>
            {freq && <TrustBadge trust={freq.trust} />}
            {isDone && <span className="chip">{t('common.done')}</span>}
          </>
        }
        primary={{
          label: isDone ? t('day.again') : t('day.start'),
          onClick: handleStart,
          icon: (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
            </svg>
          ),
        }}
        secondary={{
          label: t('player.credits'),
          onClick: () => setInfoOpen(true),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 8h.01M11 11h1v5h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ),
        }}
      />

      {band && !bandIsSubject && (
        <p className="txt-3 mt-8 text-center text-[12px] leading-relaxed">
          {t('day.supporting')}
          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
            {shortLabel(band, lang)}
          </span>{' '}
          <span className="readout">({beatHz} Hz)</span>
          {t('day.supportingTail')}
        </p>
      )}

      <div className="mt-6">
        <ListeningMode compact hasBeatLayer />
      </div>

      {freq && (
        <div className="glass mt-5 rounded-3xl p-4">
          <p className="txt-2 text-sm leading-relaxed">{freqInfo(freq, lang)}</p>
          <p className="txt-3 mt-2 text-[11px] leading-relaxed">{t(trustNoticeKey(freq.trust))}</p>
        </div>
      )}

      <div className="glass mt-4 rounded-3xl p-4">
        <h3 className="rule-label mb-3">{t('day.howDidYouFeel')}</h3>
        <p className="txt-3 mb-3 text-[11px]">{isDone ? t('day.moodDone') : t('day.moodNew')}</p>
        <MoodPicker value={mood} onPick={handleMood} />
      </div>

      <InfoPanel freq={freq ?? null} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  )
}
