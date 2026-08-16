import { PURPOSE_LABEL, getFrequency, getJourney } from '../lib/catalog'
import { navigate } from '../lib/router'
import { bandForDay } from '../lib/journeyConfig'
import { useJourneys } from '../store/journeyStore'
import { Card, Screen, TrustBadge } from './ui'

const MOOD_FACE: Record<number, string> = { 1: '😣', 2: '😕', 3: '😐', 4: '🙂', 5: '😌' }

export function JourneyDetail({ id }: { id: string }) {
  const journey = getJourney(id)
  const { progress, start, reset } = useJourneys()

  if (!journey) {
    return (
      <Screen title="מסע לא נמצא" onBack>
        <p className="txt-2 text-sm">המסע הזה כבר לא קיים בקטלוג.</p>
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
    <Screen title={journey.title} subtitle={journey.description} onBack>
      {/* Progress header */}
      <Card glow className="mb-5">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="chip">{PURPOSE_LABEL[journey.purpose]}</span>
              <span className="txt-3 ltr text-[11px]">{journey.days} ימים</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: 'linear-gradient(90deg, hsl(var(--h) 92% 62%), hsl(calc(var(--h) + 40) 90% 60%))',
                    boxShadow: '0 0 14px var(--glow)',
                  }}
                />
              </div>
              <span className="txt-2 ltr text-xs font-semibold tabular-nums">
                {done}/{journey.days}
              </span>
            </div>
          </div>
        </div>
        <button onClick={handleStart} className="btn btn-primary mt-4 w-full">
          {complete ? 'האזן שוב' : p ? `המשך — יום ${p.currentDay}` : 'התחל מסע'}
        </button>
        {p && (
          <button
            onClick={() => {
              if (confirm('לאפס את ההתקדמות במסע הזה?')) reset(journey.id)
            }}
            className="btn btn-ghost mt-2 w-full text-xs txt-3"
          >
            איפוס התקדמות
          </button>
        )}
      </Card>

      {/* Day list */}
      <div className="space-y-2">
        {journey.schedule.map((day) => {
          const freq = getFrequency(day.frequencyId)
          const band = bandForDay(day, journey)
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
                    background: isDone ? 'var(--accent-soft)' : `hsl(${freq?.hue ?? 265} 85% 62% / 0.14)`,
                    border: `1px solid ${isDone ? 'var(--accent-line)' : `hsl(${freq?.hue ?? 265} 85% 65% / 0.35)`}`,
                    color: isDone ? 'var(--accent)' : `hsl(${freq?.hue ?? 265} 90% 72%)`,
                  }}
                >
                  {isDone ? '✓' : <span className="ltr">{day.day}</span>}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{freq?.label ?? day.frequencyId}</p>
                    {isCurrent && <span className="chip">היום שלך</span>}
                    {mood && <span className="text-sm leading-none">{MOOD_FACE[mood]}</span>}
                  </div>
                  <p className="txt-3 mt-0.5 text-[11px]">
                    <span className="ltr">
                      {freq?.hz ? `${freq.hz} Hz` : `${freq?.range?.[0]}–${freq?.range?.[1]} Hz`} ·{' '}
                      {day.durationMin} דק׳
                    </span>{' '}
                    · {day.note}
                    {band && !freq?.range && (
                      <> · + {band.label.split('—')[0].trim()}</>
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
