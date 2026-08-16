import { JOURNEYS, PURPOSE_LABEL, getFrequency } from '../lib/catalog'
import type { JourneyPurpose } from '../lib/types'
import { navigate } from '../lib/router'
import { useJourneys } from '../store/journeyStore'
import { Card, Screen } from './ui'

/** Typed as a total record so adding a purpose without a colour fails the build. */
const PURPOSE_HUE: Record<JourneyPurpose, number> = {
  sleep: 258,
  focus: 44,
  spiritual: 292,
  anxiety: 190,
  intro: 165,
  energy: 28,
  creativity: 320,
  body: 8,
  rhythm: 96,
}

export function JourneyList() {
  const progress = useJourneys((s) => s.progress)

  return (
    <Screen title="מסעות" subtitle="תוכניות רב-יומיות עם תדר וזמן לכל יום" onBack>
      <div className="space-y-3">
        {JOURNEYS.map((journey) => {
          const p = progress[journey.id]
          const done = p?.completedDays.length ?? 0
          const pct = Math.round((done / journey.days) * 100)
          const complete = done >= journey.days
          const hue = PURPOSE_HUE[journey.purpose]

          return (
            <Card key={journey.id} glow={!!p} onClick={() => navigate(`/journey/${journey.id}`)}>
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
        })}
      </div>

      <p className="txt-3 mt-5 px-1 text-[11px] leading-relaxed">
        המסעות הם מבנה האזנה מוצע, לא פרוטוקול טיפולי. אפשר לדלג בין ימים בכל שלב, ואפשר להוסיף מסעות
        משלך בקובץ <span className="ltr">src/data/journeys.json</span>.
      </p>
    </Screen>
  )
}
