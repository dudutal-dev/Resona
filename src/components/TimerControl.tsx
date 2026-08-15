import { FADE_OUT_SECONDS, TIMER_LABEL } from '../audio/SessionPlayer'
import { useSession } from '../store/sessionStore'
import type { TimerMode } from '../lib/types'
import { formatClock } from './ui'

const MODES: TimerMode[] = ['15', '30', '60', '120', 'untilMorning', 'unlimited']

export function TimerControl() {
  const { config, setTimerMode, remaining, isPlaying, isFading } = useSession()

  return (
    <div className="glass rounded-3xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 9v4l2.5 2M9 2h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          טיימר
        </h3>
        {isPlaying && (
          <span className="ltr text-xs tabular-nums txt-2">
            {remaining === null ? '∞' : formatClock(remaining)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* A journey day prescribes its own length; it shows here as an extra pill. */}
        {config.timerMode === 'custom' && (
          <button
            aria-pressed
            className="rim rounded-2xl px-2 py-2.5 text-xs font-semibold"
            style={{
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent-line)',
              color: 'var(--accent)',
            }}
          >
            <span className="ltr">{config.customMinutes}</span> דק׳
          </button>
        )}
        {MODES.map((mode) => {
          const active = config.timerMode === mode
          return (
            <button
              key={mode}
              onClick={() => setTimerMode(mode)}
              aria-pressed={active}
              className={`rounded-2xl px-2 py-2.5 text-xs font-semibold transition-all ${active ? 'rim' : ''}`}
              style={{
                background: active ? 'var(--accent-soft)' : 'var(--card)',
                border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--txt-2)',
              }}
            >
              {TIMER_LABEL[mode]}
            </button>
          )
        })}
      </div>

      <p className="txt-3 mt-3 text-[11px] leading-relaxed">
        {isFading
          ? 'הדעיכה החלה — העוצמה יורדת בהדרגה עד לשקט.'
          : `בסיום הזמן העוצמה דועכת לאורך ${FADE_OUT_SECONDS} שניות במקום להיפסק בבת אחת.`}
      </p>
    </div>
  )
}
