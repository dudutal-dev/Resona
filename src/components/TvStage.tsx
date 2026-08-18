import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { mediaRoute } from '../audio/MediaRoute'
import { FIGURES, figureAt } from '../data/figures'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'
import { FigureField } from './FigureField'
import { formatClock } from './ui'

/**
 * The one figure that is a scene rather than a picture, split off on its own.
 *
 * It brings the whole Three.js stack with it — 250KB gzipped, more than the rest
 * of the app — so it is its own chunk and is imported only when it is chosen.
 * That keeps it out of the first paint; the service worker still precaches it, so
 * the figure works offline like the rest.
 */
const ChakraScene = lazy(() =>
  import('../three/ChakraScene').then((m) => ({ default: m.ChakraScene })),
)

/**
 * Full-screen presentation mode, shaped for a television.
 *
 * Everything here follows from the frame being looked at from across a room
 * rather than held: the type is set in viewport units so it scales with the
 * screen, and the readouts sit inside a 6% margin, because televisions still
 * overscan.
 *
 * It gets to the television by Screen Mirroring, not by anything the page does.
 * This used to offer a cast button that combined the visualiser's canvas with
 * the audio into one MediaStream and handed it to AirPlay; Safari accepted it
 * and the television showed the Now Playing card instead of the picture, because
 * AirPlay carries a media source rather than a MediaStream. `MediaRoute` has the
 * full account. What remains is the part that works: fill the screen, hold the
 * display awake, and say which system control to use.
 */
export function TvStage({ onClose }: { onClose: () => void }) {
  const { t, lang } = useT()
  const { config, isPlaying, elapsed, remaining, activeJourney } = useSession()
  const figureIndex = useSettings((s) => s.figure)
  const figure = figureAt(figureIndex)
  const setFigure = useSettings((s) => s.setFigure)
  const [pickerOpen, setPickerOpen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [portrait, setPortrait] = useState(false)

  const root = getFrequency(config.rootId)
  // Read per render rather than once: the accent follows the frequency, and the
  // frequency can change while the stage is open.
  const accent =
    typeof document === 'undefined'
      ? undefined
      : `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--h').trim() || 265}, 90%, 60%)`
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

  // Mirroring sends the phone's screen as it is, so a portrait phone puts a
  // tall picture on a wide television. Worth saying once, rather than leaving
  // someone looking at two black bars.
  useEffect(() => {
    const read = () => setPortrait(window.innerHeight > window.innerWidth * 1.1)
    read()
    window.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    return () => {
      window.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
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
    const id = setTimeout(() => setChromeVisible(false), 5200)
    return () => clearTimeout(id)
  }, [chromeVisible])

  return (
    <div
      ref={stageRef}
      className="fixed inset-0 z-[60] overflow-hidden bg-black"
      onClick={() => setChromeVisible(true)}
    >
      {/* The picture is the whole screen: mirroring sends exactly this. */}
      {figure.kind === 'image' ? (
        <FigureField src={figure.src} playing={isPlaying} scale={1.6} className="absolute inset-0" />
      ) : (
        <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
          <ChakraScene
            className="absolute inset-0"
            frequencyHz={root?.hz ?? 528}
            // The accent as the rest of the app computes it, so the scene is the
            // same colour as the readouts over it rather than its own idea of
            // what this frequency looks like.
            color={accent}
            reactive
          />
        </Suspense>
      )}

      {/* Readouts, inside a television-safe margin. */}
      <div className="pointer-events-none absolute inset-0">
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

        <div className="absolute text-end" style={{ bottom: '6%', insetInlineEnd: '6%' }}>
          <p
            className="ltr font-semibold tabular-nums opacity-70"
            style={{ fontSize: 'min(3vh, 2vw)' }}
          >
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

      {/*
        Controls, fading with the rest of the chrome. Ordered above the canvas
        explicitly rather than by being later in the document, since the canvas
        fills the stage and anything that ends up painting over these takes every
        press with it — including the way out.
      */}
      <div
        className={`absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4 transition-opacity duration-500 ${
          chromeVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="btn h-11 rounded-2xl px-4 text-xs">
            {t('tv.exit')}
          </button>
          <button
            onClick={(e) => {
              // The stage itself listens for taps to bring the chrome back; without
              // this the click would also count as that and restart its timer.
              e.stopPropagation()
              setPickerOpen(true)
            }}
            className="btn h-11 rounded-2xl px-4 text-xs"
          >
            {t('figure.pick')} · {t(figure.name)}
          </button>
        </div>
        <p className="max-w-[22rem] text-end text-[11px] leading-relaxed txt-3">
          {t('tv.mirror')}
          {portrait && <span className="block mt-1 opacity-80">{t('tv.rotate')}</span>}
        </p>
      </div>

      {/*
        A grid, not a cycle button.
        
        One button that advances by one was right with four figures and wrong
        with twelve: going back one meant pressing it eleven times, and the only
        way to know what any of them looked like was to land on it. The pictures
        are the labels here, so the picker shows them.
      */}
      {pickerOpen && (
        <div
          className="absolute inset-0 z-20 overflow-y-auto bg-black/85 p-5"
          style={{ backdropFilter: 'blur(6px)' }}
          onClick={(e) => {
            e.stopPropagation()
            setPickerOpen(false)
          }}
        >
          <p className="mb-4 text-center text-xs font-semibold">{t('figure.pickTitle')}</p>
          <div className="mx-auto grid max-w-3xl grid-cols-3 gap-3 sm:grid-cols-4">
            {FIGURES.map((entry, index) => {
              const chosen = index === ((figureIndex % FIGURES.length) + FIGURES.length) % FIGURES.length
              return (
                <button
                  key={entry.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFigure(index)
                    setPickerOpen(false)
                  }}
                  className="overflow-hidden rounded-xl text-[10px]"
                  style={{
                    border: `1px solid ${chosen ? 'var(--accent)' : 'rgba(255,255,255,0.14)'}`,
                    boxShadow: chosen ? '0 0 18px var(--glow)' : 'none',
                  }}
                >
                  <span className="block aspect-[3/4] bg-black">
                    {entry.kind === 'image' ? (
                      <img
                        src={entry.src}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover opacity-90"
                      />
                    ) : (
                      // The scene has no still to show, so it says so.
                      <span className="grid h-full w-full place-items-center text-[22px]">◎</span>
                    )}
                  </span>
                  <span className="block truncate px-1 py-1.5">{t(entry.name)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p
        className={`pointer-events-none absolute inset-x-0 bottom-3 z-10 text-center text-[11px] txt-3 transition-opacity duration-500 ${
          chromeVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {t('tv.hint')}
      </p>
    </div>
  )
}
