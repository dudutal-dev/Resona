import { useEffect, useRef, useState } from 'react'
import { mediaRoute } from '../audio/MediaRoute'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { useSession } from '../store/sessionStore'
import { FigureField } from './FigureField'
import { formatClock } from './ui'

/**
 * Full-screen presentation mode, shaped for a television.
 *
 * Everything here follows from the frame being looked at from across a room
 * rather than held: the stage is a fixed 16:9 box letterboxed into whatever the
 * screen is, so what a receiver gets is the right shape and not a phone with
 * bars; the type is set in viewport units against the stage rather than the
 * page, so it scales with the box; and the readouts sit inside a 6% margin,
 * because televisions still overscan.
 *
 * It is also the surface that gets cast. The visualiser's own canvas is handed
 * up so `MediaRoute` can capture it — the picture that goes to the television
 * is the same canvas being drawn here, not a re-render.
 */
export function TvStage({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT()
  const { config, isPlaying, elapsed, remaining, activeJourney } = useSession()
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [casting, setCasting] = useState(mediaRoute.isCastingVideo)
  const [castFailed, setCastFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)

  const root = getFrequency(config.rootId)
  const beat = config.beatId ? getFrequency(config.beatId) : null
  const journey = activeJourney ? getJourney(activeJourney.journeyId) : null

  // Full screen and a wake lock: a picture that vanishes after 30 seconds is
  // not a presentation mode.
  useEffect(() => {
    const el = stageRef.current
    void el?.requestFullscreen?.().catch(() => {})
    void mediaRoute.setWakeLock(true)
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // The controls fade out and come back on a tap, so a still room shows only
  // the picture.
  useEffect(() => {
    if (!chromeVisible) return
    const id = setTimeout(() => setChromeVisible(false), 4200)
    return () => clearTimeout(id)
  }, [chromeVisible])

  const cast = async () => {
    if (!canvasRef.current) return
    setBusy(true)
    setCastFailed(false)
    const ok = await mediaRoute.castVideo(canvasRef.current)
    setCasting(mediaRoute.isCastingVideo)
    if (!ok) setCastFailed(true)
    setBusy(false)
    setChromeVisible(true)
  }

  const stopCast = async () => {
    setBusy(true)
    await mediaRoute.stopVideoCast()
    setCasting(mediaRoute.isCastingVideo)
    setBusy(false)
  }

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-[60] grid place-items-center bg-black"
      onClick={() => setChromeVisible(true)}
    >
      {/* The 16:9 box is the picture. Everything outside it is letterbox. */}
      <div
        className="relative w-full overflow-hidden bg-black"
        style={{ aspectRatio: '16 / 9', maxHeight: '100%', maxWidth: '100%' }}
      >
        <FigureField
          playing={isPlaying}
          scale={1.6}
          className="absolute inset-0"
          onCanvas={(c) => (canvasRef.current = c)}
        />

        {/* Readouts, inside a television-safe margin. */}
        <div className="pointer-events-none absolute inset-0" style={{ padding: '6%' }}>
          {journey && (
            <div className="absolute" style={{ top: '6%', insetInlineStart: '6%' }}>
              <p
                className="font-semibold uppercase tracking-[0.25em] opacity-60"
                style={{ fontSize: 'min(1.6vh, 1.1vw)' }}
              >
                {journeyTitle(journey, lang)}
              </p>
              <p className="font-bold" style={{ fontSize: 'min(3.2vh, 2.2vw)' }}>
                {t('common.dayN', { n: activeJourney?.day ?? 0 })}
              </p>
            </div>
          )}

          <div className="absolute" style={{ bottom: '6%', insetInlineStart: '6%' }}>
            <p
              className="ltr font-bold leading-none"
              style={{
                fontSize: 'min(13vh, 9vw)',
                color: 'var(--accent)',
                textShadow: '0 0 max(2vh, 1.4vw) var(--glow)',
              }}
            >
              {root?.hz ?? '—'}
              <span className="opacity-60" style={{ fontSize: '0.32em' }}> Hz</span>
            </p>
            <p className="mt-[1vh] font-semibold" style={{ fontSize: 'min(2.6vh, 1.8vw)' }}>
              {root ? freqLabel(root, lang) : ''}
            </p>
          </div>

          <div
            className="absolute text-end"
            style={{ bottom: '6%', insetInlineEnd: '6%' }}
          >
            <p className="ltr font-semibold tabular-nums opacity-70" style={{ fontSize: 'min(3vh, 2vw)' }}>
              {formatClock(elapsed)}
              {remaining !== null && <span className="opacity-50"> / {formatClock(remaining)}</span>}
            </p>
            {beat && (
              <p className="opacity-55" style={{ fontSize: 'min(2vh, 1.4vw)' }}>
                <span className="ltr">{config.beatHz} Hz</span> · {shortLabel(beat, lang)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Controls, over the letterbox so they never sit in the captured frame. */}
      <div
        className={`absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 transition-opacity duration-500 ${
          chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <button onClick={onClose} className="btn h-11 rounded-2xl px-4 text-xs">
          {t('tv.exit')}
        </button>
        {mediaRoute.canPickOutputDevice() && (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => void (casting ? stopCast() : cast())}
              disabled={busy || !isPlaying}
              className={`btn h-11 rounded-2xl px-4 text-xs ${casting ? '' : 'btn-primary'}`}
              style={busy || !isPlaying ? { opacity: 0.5 } : undefined}
            >
              {busy ? t('output.connecting') : casting ? t('tv.stopCast') : t('tv.cast')}
            </button>
            {castFailed && (
              <p className="max-w-[16rem] text-end text-[11px] leading-relaxed txt-3">
                {t('tv.castFailed')}
              </p>
            )}
          </div>
        )}
      </div>

      <p
        className={`absolute inset-x-0 bottom-3 text-center text-[11px] txt-3 transition-opacity duration-500 ${
          chromeVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {t('tv.hint')}
      </p>
    </div>
  )
}
