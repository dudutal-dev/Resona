import { FADE_OUT_SECONDS } from '../audio/SessionPlayer'
import { useT, type StringKey } from '../lib/i18n'
import { useSession } from '../store/sessionStore'
import type { TimerMode } from '../lib/types'
import { formatClock } from './ui'

const MODES: TimerMode[] = ['15', '30', '60', '120', 'untilMorning', 'unlimited']

export function TimerControl() {
  const { config, setTimerMode, remaining, isPlaying, isFading } = useSession()
  const { t } = useT()

  return (
    <div className="glass brackets rounded-3xl p-4">
      {/* The label, then a rule out to the panel edge, then the clock sitting on
          the end of that rule — so the countdown reads off the same line rather
          than floating opposite a heading. */}
      <div className="mb-3 flex items-center gap-2.5">
        <h3 className="rule-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {t('timer.label')}
        </h3>
        {isPlaying && (
          <span className="readout text-xs txt-2">
            {remaining === null ? '∞' : formatClock(remaining)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* A journey day prescribes its own length; it shows here as an extra pill. */}
        {config.timerMode === 'custom' && (
          <button
            aria-pressed
            className="rim rounded-[4px] px-2 py-2.5 text-xs font-semibold"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              color: 'var(--accent)',
            }}
          >
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
              className={`rounded-[4px] px-2 py-2.5 text-xs font-semibold transition-all ${active ? 'rim' : ''}`}
              style={{
                background: active ? 'var(--accent-soft)' : 'var(--card)',
                border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--txt-2)',
              }}
            >
              {t(`timer.${mode}` as StringKey)}
            </button>
          )
        })}
      </div>

      <p className="txt-3 mt-3 text-[11px] leading-relaxed">
        {isFading
          ? t('timer.fading')
          : t('timer.fadeNote', { seconds: FADE_OUT_SECONDS })}
      </p>
    </div>
  )
}
