import { useEffect, useState } from 'react'
import { mediaRoute } from '../audio/MediaRoute'
import { useSettings } from '../store/settingsStore'
import { useSession } from '../store/sessionStore'

const CastIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 18h.01M3 14a4 4 0 014 4M3 10a8 8 0 018 8"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
    />
    <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

const ScreenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M11 18.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

/**
 * Playback destination and screen behaviour.
 *
 * The in-app AirPlay picker only exists in Safari; everywhere else the honest
 * answer is that routing is an OS-level control, so that is what the panel
 * says instead of showing a button that would do nothing.
 */
export function OutputControl() {
  const { keepScreenAwake, setKeepScreenAwake } = useSettings()
  const isPlaying = useSession((s) => s.isPlaying)
  const [canPick, setCanPick] = useState(false)
  const [external, setExternal] = useState(false)
  const [failed, setFailed] = useState(false)
  /** null = not attempted yet, false = asked for and refused. */
  const [wakeHeld, setWakeHeld] = useState<boolean | null>(null)

  useEffect(() => {
    setCanPick(mediaRoute.canPickOutputDevice())
  }, [])

  // The wake lock is only worth holding while something is actually playing.
  useEffect(() => {
    const want = keepScreenAwake && isPlaying
    void mediaRoute.setWakeLock(want).then((held) => setWakeHeld(want ? held : null))
  }, [keepScreenAwake, isPlaying])

  const pick = async () => {
    setFailed(false)
    const ok = await mediaRoute.showOutputPicker()
    if (!ok) setFailed(true)
    else setExternal(mediaRoute.isExternal)
  }

  return (
    <div className="glass rounded-3xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <CastIcon />
        השמעה ומכשירים
      </h3>

      {canPick ? (
        <>
          <button onClick={() => void pick()} className="btn w-full text-xs" disabled={!isPlaying}>
            {external ? 'החלף מכשיר השמעה' : 'השמע למכשיר בסביבה (AirPlay)'}
          </button>
          {!isPlaying && (
            <p className="txt-3 mt-2 text-[11px]">התחל נגינה כדי לבחור מכשיר.</p>
          )}
          {failed && (
            <p className="txt-3 mt-2 text-[11px]">
              לא הצלחתי לפתוח את בורר המכשירים. אפשר לבחור מכשיר גם ממרכז הבקרה של המכשיר.
            </p>
          )}
        </>
      ) : (
        <p className="txt-2 text-[12px] leading-relaxed">
          הדפדפן הזה לא חושף בורר מכשירים לדף עצמו. אפשר לנתב את הצליל לרמקול, לטלוויזיה או
          לאוזניות דרך בקרת השמע של המכשיר — <span className="font-semibold">מרכז הבקרה</span> באייפון
          או בורר פלט השמע במחשב. הניתוב חל על כל מה שמתנגן, כולל Resona.
        </p>
      )}

      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setKeepScreenAwake(!keepScreenAwake)}
          role="switch"
          aria-checked={keepScreenAwake}
          className="flex w-full items-center gap-3 text-right"
        >
          <span className="txt-3 shrink-0">
            <ScreenIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">השאר את המסך דלוק</span>
            <span className="txt-3 mt-0.5 block text-[11px] leading-relaxed">
              {!mediaRoute.supportsWakeLock
                ? 'הדפדפן הזה לא תומך בנעילת מסך. אפשר להאריך את זמן הכיבוי בהגדרות המכשיר.'
                : keepScreenAwake && !isPlaying
                  ? 'יופעל כשתתחיל נגינה.'
                  : wakeHeld === false
                    ? 'הבקשה נדחתה על ידי הדפדפן. בדרך כלל זה קורה כשהדף לא בחזית.'
                    : wakeHeld
                      ? 'פעיל — המסך לא ייכבה בזמן ההאזנה.'
                      : 'מונע מהמסך לכבות באמצע האזנה. אינו מאפשר נגינה אחרי מעבר לאפליקציה אחרת.'}
            </span>
          </span>
          <span
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
            style={{
              background: keepScreenAwake ? 'hsl(var(--h) 92% 62%)' : 'var(--border)',
              boxShadow: keepScreenAwake ? '0 0 18px var(--glow)' : undefined,
            }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200"
              style={{ right: keepScreenAwake ? '0.25rem' : '1.75rem' }}
            />
          </span>
        </button>
      </div>
    </div>
  )
}
