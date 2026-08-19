import { FADE_OUT_SECONDS } from '../audio/SessionPlayer'
import { useT, type StringKey } from '../lib/i18n'
import { useSession } from '../store/sessionStore'
import type { TimerMode } from '../lib/types'
import { formatClock } from './ui'

const MODES: TimerMode[] = ['15', '30', '60', '120', 'untilMorning', 'unlimited']

/**
 * How long the session runs.
 *
 * This used to be a bracketed panel of six bordered boxes, in the instrument
 * language the rest of the app has since moved off. It sat under a release page
 * whose whole point is that the picture is the loudest thing on it, and it was
 * heavier than the two buttons above it. Nothing is boxed now: a quiet label
 * with the countdown on the end of it, and the choices as chips that are filled
 * when chosen and barely there when not.
 */
export function TimerControl() {
  const { config, setTimerMode, remaining, isPlaying, isFading } = useSession()
  const { t } = useT()

  // Gold marks the chosen one, as it does in the navigation and on every other
  // chip in the app. The frequency's hue is reserved for the object itself.
  const chip = (active: boolean) =>
    `obj rounded-full px-4 py-2.5 text-[13px] font-bold leading-none transition-all active:scale-95 ${
      active ? '' : 'txt-2'
    }`
  const chipStyle = (active: boolean) =>
    active
      ? { background: 'var(--gold-soft)', borderColor: 'var(--gold)', color: 'var(--gold)' }
      : undefined

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
        <h3 className="text-[15px] font-extrabold tracking-tight">{t('timer.label')}</h3>
        {isPlaying && (
          <span className="txt-3 readout text-[13px] font-semibold">
            {remaining === null ? '∞' : formatClock(remaining)}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {/* A journey day prescribes its own length; it shows here as an extra
            chip that cannot be chosen, because the day already chose. */}
        {config.timerMode === 'custom' && (
          <button aria-pressed className={chip(true)} style={chipStyle(true)}>
            <span className="readout">{config.customMinutes}</span> {t('common.min')}
          </button>
        )}
        {MODES.map((mode) => {
          const active = config.timerMode === mode
          return (
            <button
              key={mode}
              onClick={() => setTimerMode(mode)}
              aria-pressed={active}
              className={chip(active)}
              style={chipStyle(active)}
            >
              {t(`timer.${mode}` as StringKey)}
            </button>
          )
        })}
      </div>

      <p className="txt-3 mt-3 px-0.5 text-[11px] leading-relaxed">
        {isFading ? t('timer.fading') : t('timer.fadeNote', { seconds: FADE_OUT_SECONDS })}
      </p>
    </section>
  )
}
