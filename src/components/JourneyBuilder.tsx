import { useMemo, useState } from 'react'
import { dayNote, freqLabel, getFrequency, journeyDescription, journeyTitle } from '../lib/catalog'
import { journeyCover } from '../lib/cover'
import { useT, type StringKey } from '../lib/i18n'
import { configForDay } from '../lib/journeyConfig'
import { navigate, back } from '../lib/router'
import {
  BUILDER_DEFAULTS,
  DAY_CHOICES,
  MINUTE_CHOICES,
  buildJourney,
  type BuilderAnswers,
  type BuilderGoal,
  type BuilderShape,
  type BuilderSound,
} from '../lib/journeyBuilder'
import { useCustomJourneys } from '../store/customJourneyStore'
import { useJourneys } from '../store/journeyStore'
import { TrustBadge } from './ui'

/**
 * Builds a journey by asking about the week rather than about the settings.
 *
 * Five questions, one screen each, and none of them names a frequency or a
 * brainwave band — those are what the answers produce. The last screen is the
 * finished thing: its own generated cover, its name, the sentence explaining
 * what it does and why, and every day listed. Nothing is saved until it is
 * accepted, and what gets saved is the schedule rather than the answers, so a
 * week already under way cannot change under the person walking it.
 */

type StepId = 'goal' | 'days' | 'minutes' | 'sound' | 'shape'
const STEPS: StepId[] = ['goal', 'days', 'minutes', 'sound', 'shape']

const GOALS: BuilderGoal[] = ['sleep', 'calm', 'focus', 'energy', 'spiritual', 'body', 'club']
const SOUNDS: BuilderSound[] = ['still', 'flowing', 'beat']
const SHAPES: BuilderShape[] = ['ascending', 'descending', 'steady']

function Choice({
  label,
  note,
  active,
  onClick,
}: {
  label: string
  note?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="obj w-full px-4 py-4 text-start transition-all active:scale-[0.98]"
      style={
        active
          ? { background: 'var(--gold-soft)', borderColor: 'var(--gold)', color: 'var(--gold)' }
          : undefined
      }
    >
      <span className="block text-[15.5px] font-extrabold leading-tight">{label}</span>
      {note && (
        <span className="txt-3 mt-0.5 block text-[12px] leading-relaxed">{note}</span>
      )}
    </button>
  )
}

export function JourneyBuilder() {
  const { t, lang } = useT()
  const saveCustom = useCustomJourneys((s) => s.save)
  const startJourney = useJourneys((s) => s.start)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<BuilderAnswers>(BUILDER_DEFAULTS)

  const done = step >= STEPS.length
  // Built on every answer change so the preview is the thing that will be
  // saved, not a description of it.
  const preview = useMemo(() => buildJourney(answers, 'preview'), [answers])

  const set = <K extends keyof BuilderAnswers>(key: K, value: BuilderAnswers[K]) => {
    setAnswers((a) => ({ ...a, [key]: value }))
    // Answering advances. Going back to change one is the back button, which is
    // the only thing a five-question flow needs.
    setStep((s) => s + 1)
  }

  const accept = () => {
    const { id: _drop, ...rest } = preview
    void _drop
    const id = saveCustom(rest)
    startJourney(id)
    navigate(`/journey/${id}`)
  }

  const current = STEPS[step]

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-40 safe-top">
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => (step === 0 ? back() : setStep((s) => s - 1))}
          aria-label={t('common.back')}
          className="orb-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="flip-ltr">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* One dot per question, filled as far as you have come. */}
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <span
              key={s}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === step ? 18 : 6,
                background: i <= step ? 'var(--gold)' : 'var(--border-strong)',
              }}
            />
          ))}
        </div>
      </div>

      {!done && (
        <div key={current} className="animate-fade-up mt-8">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-tight">
            {t(`build.${current}.q` as StringKey)}
          </h1>
          <p className="txt-3 mt-1.5 text-[13px] leading-relaxed">
            {t(`build.${current}.hint` as StringKey)}
          </p>

          <div className="mt-6 space-y-2.5">
            {current === 'goal' &&
              GOALS.map((g) => (
                <Choice
                  key={g}
                  label={t(`build.goal.${g}` as StringKey)}
                  note={t(`build.goal.${g}.note` as StringKey)}
                  active={answers.goal === g}
                  onClick={() => set('goal', g)}
                />
              ))}

            {current === 'days' &&
              DAY_CHOICES.map((d) => (
                <Choice
                  key={d}
                  label={t('common.stagesN', { n: d })}
                  active={answers.days === d}
                  onClick={() => set('days', d)}
                />
              ))}

            {current === 'minutes' &&
              MINUTE_CHOICES.map((m) => (
                <Choice
                  key={m}
                  label={`${m} ${t('common.minutes')}`}
                  active={answers.minutes === m}
                  onClick={() => set('minutes', m)}
                />
              ))}

            {current === 'sound' &&
              SOUNDS.map((s) => (
                <Choice
                  key={s}
                  label={t(`build.sound.${s}` as StringKey)}
                  note={t(`build.sound.${s}.note` as StringKey)}
                  active={answers.sound === s}
                  onClick={() => set('sound', s)}
                />
              ))}

            {current === 'shape' &&
              SHAPES.map((s) => (
                <Choice
                  key={s}
                  label={t(`build.shape.${s}` as StringKey)}
                  note={t(`build.shape.${s}.note` as StringKey)}
                  active={answers.shape === s}
                  onClick={() => set('shape', s)}
                />
              ))}
          </div>
        </div>
      )}

      {done && (
        <div className="animate-fade-up mt-6">
          <img
            src={journeyCover(preview)}
            alt=""
            className="mx-auto block aspect-square w-[62%] max-w-[268px] rounded-[12px] object-cover"
            style={{ boxShadow: '0 24px 50px -18px rgba(0,0,0,0.75)' }}
          />
          <p
            className="txt-3 mt-6 text-center text-[11px] font-semibold uppercase"
            style={{ letterSpacing: '0.16em' }}
          >
            {t('build.yours')}
          </p>
          <h1 className="mt-3 text-center text-[26px] font-extrabold leading-tight tracking-tight">
            {journeyTitle(preview, lang)}
          </h1>

          <p className="txt-2 mt-4 text-[13px] leading-relaxed">
            {journeyDescription(preview, lang)}
          </p>

          <div className="mt-6 flex items-stretch gap-3">
            <button onClick={accept} className="cta flex-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('build.keep')}
            </button>
            <button onClick={() => setStep(0)} className="obj flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-4 text-[15px] font-extrabold">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.4L4 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4v5h5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('build.again')}
            </button>
          </div>

          {/* The week itself, so nothing is accepted sight unseen. */}
          <h2 className="mt-8 text-[15px] font-extrabold tracking-tight">{t('build.theWeek')}</h2>
          <div className="mt-2 -mx-1">
            {preview.schedule.map((day) => {
              const freq = getFrequency(day.frequencyId)
              const resolved = configForDay(day, preview)
              const band = getFrequency(resolved.beatId ?? '')
              return (
                <div key={day.day} className="flex items-center gap-3 rounded-[10px] px-1 py-2.5">
                  <span className="readout txt-3 grid w-6 shrink-0 place-items-center text-[13px] font-bold">
                    {day.day}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">
                      {freq ? freqLabel(freq, lang) : day.frequencyId}
                    </span>
                    <span className="txt-3 mt-0.5 block truncate text-[11px]">
                      <span className="ltr">
                        <span className="readout">{freq?.hz} Hz</span> ·{' '}
                        <span className="readout">{day.durationMin}</span> {t('common.min')}
                        {band && (
                          <>
                            {' · + '}
                            {band.label.split('—')[0].trim()}{' '}
                            <span className="readout">{resolved.beatHz} Hz</span>
                          </>
                        )}
                      </span>
                      {' · '}
                      {dayNote(day, lang)}
                    </span>
                  </span>
                  {freq && <TrustBadge trust={freq.trust} />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
