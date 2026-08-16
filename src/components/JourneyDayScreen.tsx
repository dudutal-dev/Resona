import { useState } from 'react'
import { TRUST_NOTICE, getFrequency, getJourney } from '../lib/catalog'
import { configForDay } from '../lib/journeyConfig'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { useJourneys } from '../store/journeyStore'
import type { MoodScore } from '../lib/types'
import { Card, Screen, TrustBadge } from './ui'
import { MoodPicker } from './MoodPicker'
import { ListeningMode } from './ListeningMode'
import { InfoPanel } from './InfoPanel'

export function JourneyDayScreen({ id, day }: { id: string; day: number }) {
  const journey = getJourney(id)
  const entry = journey?.schedule.find((d) => d.day === day)
  const { loadConfig, config } = useSession()
  const { progress, start, completeDay, setMood } = useJourneys()
  const [infoOpen, setInfoOpen] = useState(false)

  if (!journey || !entry) {
    return (
      <Screen title="יום לא נמצא" onBack>
        <p className="txt-2 text-sm">אין יום כזה במסע הזה.</p>
      </Screen>
    )
  }

  const freq = getFrequency(entry.frequencyId)
  const p = progress[journey.id]
  const isDone = p?.completedDays.includes(day) ?? false
  const mood = p?.dailyMood?.[day]

  const handleStart = () => {
    start(journey.id)
    loadConfig(configForDay(entry, config), { journeyId: journey.id, day })
    navigate('/player')
  }

  const handleMood = (score: MoodScore) => {
    if (isDone) setMood(journey.id, day, score)
    else completeDay(journey.id, day, score)
  }

  return (
    <Screen title={`יום ${day}`} subtitle={journey.title} onBack>
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
              className="ltr text-2xl font-bold leading-none"
              style={{ color: `hsl(${freq?.hue ?? 265} 92% 76%)` }}
            >
              {freq?.hz ?? freq?.range?.[0]}
            </div>
            <div className="txt-3 ltr mt-1 text-[10px] font-semibold">Hz</div>
          </div>
        </div>

        <h2 className="mt-4 text-xl font-bold">{freq?.label}</h2>
        <p className="txt-2 mt-1 text-sm">{entry.note}</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="chip">
            <span className="ltr">{entry.durationMin}</span> דקות
          </span>
          {freq && <TrustBadge trust={freq.trust} />}
          {isDone && <span className="chip">הושלם ✓</span>}
        </div>

        <div className="mt-5 text-right">
          <ListeningMode compact hasBeatLayer={!!freq?.range} />
        </div>

        <button onClick={handleStart} className="btn btn-primary mt-4 w-full">
          {isDone ? 'האזן שוב ליום זה' : 'התחל את היום'}
        </button>
        <button onClick={() => setInfoOpen(true)} className="btn btn-ghost mt-2 w-full text-xs txt-3">
          מה מיוחס לתדר הזה?
        </button>
      </Card>

      {freq && (
        <div className="glass mb-5 rounded-3xl p-4">
          <p className="txt-2 text-sm leading-relaxed">{freq.info}</p>
          <p className="txt-3 mt-2 text-[11px] leading-relaxed">{TRUST_NOTICE[freq.trust]}</p>
        </div>
      )}

      <div className="glass rounded-3xl p-4">
        <h3 className="mb-1 text-sm font-bold">איך הרגשת אחרי ההאזנה?</h3>
        <p className="txt-3 mb-3 text-[11px]">
          {isDone
            ? 'אפשר לעדכן את הדירוג בכל שלב. הכול נשמר במכשיר בלבד.'
            : 'דירוג מסמן את היום כהושלם ומעביר ליום הבא.'}
        </p>
        <MoodPicker value={mood} onPick={handleMood} />
      </div>

      <InfoPanel freq={freq ?? null} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </Screen>
  )
}
