import { useEffect, useState } from 'react'
import { mediaRoute } from '../audio/MediaRoute'
import { useT } from '../lib/i18n'
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

const BackgroundIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2.5" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <path d="M18 9v6M21 7.5v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const ScreenIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="6" y="2.5" width="12" height="19" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M11 18.5h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

/** Playback destination and screen behaviour. */
export function OutputControl() {
  const { t, rich } = useT()
  const { keepScreenAwake, setKeepScreenAwake, backgroundAudio, setBackgroundAudio } = useSettings()
  const isPlaying = useSession((s) => s.isPlaying)
  /** null = not attempted yet, false = asked for and refused. */
  const [wakeHeld, setWakeHeld] = useState<boolean | null>(null)
  const [canPick, setCanPick] = useState(false)
  const [external, setExternal] = useState(false)
  const [castFailed, setCastFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCanPick(mediaRoute.canPickOutputDevice())
  }, [])

  // Casting is a property of the audio graph, which a stop tears down.
  useEffect(() => {
    if (!isPlaying) setExternal(false)
  }, [isPlaying])

  const cast = async () => {
    setBusy(true)
    setCastFailed(false)
    const ok = await mediaRoute.showOutputPicker()
    setExternal(mediaRoute.isExternal)
    if (!ok) setCastFailed(true)
    setBusy(false)
  }

  const backToPhone = async () => {
    setBusy(true)
    await mediaRoute.setExternal(false)
    setExternal(mediaRoute.isExternal)
    setBusy(false)
  }

  // The wake lock is only worth holding while something is actually playing.
  useEffect(() => {
    const want = keepScreenAwake && isPlaying
    void mediaRoute.setWakeLock(want).then((held) => setWakeHeld(want ? held : null))
  }, [keepScreenAwake, isPlaying])

  return (
    <div className="glass rounded-3xl p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <CastIcon />
        {t('output.title')}
      </h3>

      {canPick ? (
        <>
          <button
            onClick={() => void cast()}
            disabled={!isPlaying || busy}
            className={`btn w-full text-xs ${external ? '' : 'btn-primary'}`}
            style={!isPlaying || busy ? { opacity: 0.5 } : undefined}
          >
            {busy ? t('output.connecting') : external ? t('output.switchDevice') : t('output.castTo')}
          </button>

          {external && (
            <button onClick={() => void backToPhone()} disabled={busy} className="btn mt-2 w-full text-xs">
              {t('output.backToPhone')}
            </button>
          )}

          <p className="txt-3 mt-2 text-[11px] leading-relaxed">
            {t(
              !isPlaying
                ? 'output.needPlaying'
                : castFailed
                  ? 'output.castFailed'
                  : external
                    ? 'output.casting'
                    : 'output.castIdle',
            )}
          </p>
        </>
      ) : (
        <p className="txt-2 text-[12px] leading-relaxed">
          {rich('output.noPicker')}
        </p>
      )}

      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setBackgroundAudio(!backgroundAudio)}
          role="switch"
          aria-checked={backgroundAudio}
          className="flex w-full items-center gap-3 text-start"
        >
          <span className="txt-3 shrink-0">
            <BackgroundIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('output.background')}</span>
            <span className="txt-3 mt-0.5 block text-[11px] leading-relaxed">
              {t(isPlaying ? 'output.backgroundLater' : 'output.backgroundNote')}
            </span>
          </span>
          <span
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
            style={{
              background: backgroundAudio ? 'hsl(var(--h) 92% 62%)' : 'var(--border)',
              boxShadow: backgroundAudio ? '0 0 18px var(--glow)' : undefined,
            }}
          >
            <span
              className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200"
              style={{ right: backgroundAudio ? '0.25rem' : '1.75rem' }}
            />
          </span>
        </button>
      </div>

      <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setKeepScreenAwake(!keepScreenAwake)}
          role="switch"
          aria-checked={keepScreenAwake}
          className="flex w-full items-center gap-3 text-start"
        >
          <span className="txt-3 shrink-0">
            <ScreenIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{t('output.keepAwake')}</span>
            <span className="txt-3 mt-0.5 block text-[11px] leading-relaxed">
              {t(
                !mediaRoute.supportsWakeLock
                  ? 'output.wakeUnsupported'
                  : keepScreenAwake && !isPlaying
                    ? 'output.wakeWillStart'
                    : wakeHeld === false
                      ? 'output.wakeDenied'
                      : wakeHeld
                        ? 'output.wakeHeld'
                        : 'output.wakeIdle',
              )}
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
