import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { mediaRoute } from '../audio/MediaRoute'
import { FIGURES, figureAt } from '../data/figures'
import { TurntableField } from './TurntableField'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'
import { FigureField } from './FigureField'
import { Badge } from './Badge'
import { canCastVideo, promptRemote, watchRemote, type RemoteState } from '../lib/remoteVideo'
import { turnRate, turnSeconds } from '../lib/turnClock'
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
  /**
   * The element handed to a television, and what the system says about it.
   *
   * Separate from the one `TurntableField` draws into on purpose: the moment a
   * receiver takes an element over, that element stops producing frames locally,
   * so a single shared one would put the picture on the television and leave a
   * frozen canvas behind on the phone.
   */
  const castRef = useRef<HTMLVideoElement>(null)
  const [remote, setRemote] = useState<RemoteState>('unsupported')
  const casting = remote === 'connected'

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

  /**
   * Which shape the stage is, right now.
   *
   * This is what picks the cut of the figure. There is no way for a page to be
   * told that a television is attached — mirroring sends the phone's screen as
   * it is, and the browser is not informed — so the honest signal is the only
   * one that is actually true: the shape of the surface being drawn on. Upright
   * in a hand, that is the tall cut. Turned sideways, or rendered onto a
   * television, it is the wide one. It re-measures on rotation, so the picture
   * changes with the phone rather than needing a setting.
   */
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

  // Only turntables have a file to hand over; the generated scene has no source
  // a receiver could fetch.
  const castable = figure.kind === 'turntable' && canCastVideo()

  useEffect(() => {
    const el = castRef.current
    if (!el || !castable) return
    return watchRemote(el, setRemote)
  }, [castable])

  /**
   * The revolution stays on the music's clock while casting, if the receiver
   * honours a playback rate. Whether it does is not something a page can find
   * out — the property sets cleanly either way — so this is written to be
   * correct where it works and harmless where it does not.
   *
   * A steady rate here rather than the pose choreography the local canvas gets:
   * that one adjusts the rate every frame against where the figure actually is,
   * which needs a `currentTime` that can be read back. A receiver's cannot, so
   * asking it to hold a pose would be asking it to land somewhere blind.
   */
  useEffect(() => {
    const el = castRef.current
    if (!el || !casting) return
    const period = turnSeconds({ playing: isPlaying, style: config.style, pace: config.pace })
    el.playbackRate = turnRate(el.duration || 24, period)
  }, [casting, isPlaying, config.style, config.pace])

  // Casting is the whole point of not holding the phone: give the screen back.
  useEffect(() => {
    if (!casting) return
    void mediaRoute.setWakeLock(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [casting])

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
      {/*
        The element a television takes over.

        Always mounted while a turntable is chosen, because both pickers need a
        real element with a real source to offer, and `preload="none"` means
        mounting one costs nothing until a receiver asks for it. It is the wide
        cut: a television is wide, whichever way the phone is being held.

        Left in the layout at full size and merely transparent, rather than
        hidden: a display-none or clipped element is not reliably a valid
        playback target. It sits before the canvas in document order, so the
        canvas paints over it; when a receiver takes it, the canvas is gone and
        this is what is left for the platform to draw its own placeholder into.
      */}
      {figure.kind === 'turntable' && (
        <video
          ref={castRef}
          src={figure.wide}
          poster={figure.posterWide}
          loop
          muted
          playsInline
          preload="none"
          aria-hidden
          className={`absolute inset-0 h-full w-full object-contain ${
            casting ? '' : 'pointer-events-none opacity-0'
          }`}
        />
      )}

      {/* The picture is the whole screen: mirroring sends exactly this. */}
      {casting ? null : figure.kind === 'turntable' ? (
        <TurntableField
          src={portrait ? figure.portrait : figure.wide}
          poster={portrait ? figure.poster : figure.posterWide}
          playing={isPlaying}
          className="absolute inset-0"
        />
      ) : figure.kind === 'image' ? (
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
              {t('common.stageN', { n: activeJourney?.day ?? 0 })}
            </p>
          </div>
        )}

        <div className="absolute" style={{ bottom: '6%', insetInlineStart: '6%' }}>
          <p
            className="readout font-bold leading-none"
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
            className="readout font-semibold opacity-70"
            style={{ fontSize: 'min(3vh, 2vw)' }}
          >
            {formatClock(elapsed)}
            {remaining !== null && <span className="opacity-50"> / {formatClock(remaining)}</span>}
          </p>
          {beat && (
            <p className="opacity-55" style={{ fontSize: 'min(2vh, 1.4vw)' }}>
              <span className="readout">{config.beatHz} Hz</span> · {shortLabel(beat, lang)}
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
          {/* A picker with one thing in it is a control that cannot do
              anything. It comes back on its own when artwork does. */}
          {FIGURES.length > 1 && (
            <button
              onClick={(e) => {
                // The stage itself listens for taps to bring the chrome back;
                // without this the click would also count as that and restart
                // its timer.
                e.stopPropagation()
                setPickerOpen(true)
              }}
              className="btn h-11 rounded-2xl px-4 text-xs"
            >
              {t('figure.pick')} · {t(figure.name)}
            </button>
          )}
          {/* Only when the system says there is somewhere to send it. A picker
              that opens onto an empty list is worse than no button. */}
          {castable && remote !== 'unsupported' && remote !== 'unavailable' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const el = castRef.current
                if (!el) return
                // The receiver fetches and plays the file itself, so it has to
                // be loaded and running before the handover.
                el.load()
                void el.play().catch(() => {})
                void promptRemote(el)
              }}
              className="btn h-11 rounded-2xl px-4 text-xs"
              style={
                casting
                  ? { background: 'var(--gold-soft)', borderColor: 'var(--gold)', color: 'var(--gold)' }
                  : undefined
              }
            >
              {t(casting ? 'tv.castOn' : 'tv.cast')}
            </button>
          )}
        </div>
        <p className="max-w-[22rem] text-end text-[11px] leading-relaxed txt-3">
          {t(casting ? 'tv.castNote' : 'tv.mirror')}
          {!casting && portrait && <span className="block mt-1 opacity-80">{t('tv.rotate')}</span>}
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
                    // Gold marks the chosen one here as it does everywhere
                    // else in the app; the frequency's hue belongs to the
                    // objects, not to the chrome that selects them.
                    border: `1px solid ${chosen ? 'var(--gold)' : 'rgba(255,255,255,0.14)'}`,
                    boxShadow: chosen ? '0 0 18px var(--gold-soft)' : 'none',
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
                    ) : entry.kind === 'turntable' ? (
                      // A still, not the clip. A video element is not a
                      // thumbnail: on iOS it paints nothing until it has
                      // played, so this used to be a black rectangle. The
                      // poster is a few kilobytes and is precached, so the
                      // picker also costs nothing before the clip is fetched.
                      <img
                        src={entry.poster}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover opacity-90"
                      />
                    ) : (
                      // The scene is generated, so there is no frame to grab.
                      // It gets the app's own mark instead of an empty square.
                      <span
                        className="grid h-full w-full place-items-center"
                        style={{
                          background:
                            'radial-gradient(80% 60% at 50% 35%, hsl(var(--h) 70% 45% / 0.5), #0a0a0c 75%)',
                        }}
                      >
                        <Badge hue={root?.hue ?? 265} glyph="flower" size={54} />
                      </span>
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
