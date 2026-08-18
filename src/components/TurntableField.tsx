import { useEffect, useRef } from 'react'
import { clubBpm } from '../audio/ClubGroove'
import { engine } from '../audio/ToneEngine'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'

/**
 * A figure making one revolution, turning on the music's own clock.
 *
 * The clip is five seconds of a locked-camera turntable. Left alone it would be
 * a loop playing at whatever speed it was shot at, which is wallpaper. What
 * makes it belong to this app is that the rate is derived from what is
 * actually sounding:
 *
 *  - On a **club engine** there is a real tempo, so a revolution takes sixteen
 *    bars of it. The turn completes on a phrase boundary rather than drifting
 *    against one — at 126 BPM that is a little over half a minute.
 *  - On the **ambient engine** there is no grid, but there is a note interval,
 *    which is the one number everything rhythmic there follows. A revolution
 *    takes `NOTES_PER_TURN` of those.
 *
 * The first version locked it to the brainwave rate instead. That was a nicer
 * idea on paper than in a room: theta at 6Hz came out at eight seconds a turn,
 * which reads as a figure spinning rather than a figure turning. Whatever the
 * music says, the period is held inside `SLOWEST`/`FASTEST`, because there is a
 * speed past which this stops being something you can rest your eyes on.
 *
 * Everything else is the treatment `FigureField` already applies to a still:
 * the frame is sheared into horizontal strips by the live waveform, and a
 * blurred copy of it is laid underneath as an ambient wash. Both work on a
 * video for the same reason they work on a picture — `drawImage` does not care
 * which it is given, and the source simply happens to change between frames.
 *
 * The element carries no audio track at all (see `pack-turntables.mjs`). That
 * is not an optimisation: a second media element with audio contends for the
 * system's Now Playing session, and on iOS the route follows whichever wins.
 */

/** One revolution per this many bars of a club engine. */
const BARS_PER_TURN = 16
/** One revolution per this many lead notes of the ambient engine. */
const NOTES_PER_TURN = 24
/**
 * However fast the music is, a turn takes at least this long, and however slow
 * it is, no longer than this. Twenty seconds is about where a rotation stops
 * reading as motion and starts reading as drift.
 */
const FASTEST_TURN_SECONDS = 20
const SLOWEST_TURN_SECONDS = 60
/** Nothing playing: a slow idle drift, so the figure is never simply frozen. */
const IDLE_TURN_SECONDS = 45
/** What browsers accept. Reached only if the clip length changes. */
const MIN_RATE = 0.0625
const MAX_RATE = 2

/** Strips the frame is sheared into. Matches `FigureField`. */
const STRIPS = 96

/**
 * URLs already pulled through a plain fetch, so a play/pause cycle does not ask
 * for the same file again.
 */
const warmed = new Set<string>()

/**
 * Picks the source this browser can actually decode, rather than leaving it to
 * `<source>` children. The URL has to be known here so the cache can be warmed
 * with it — see `warm`.
 */
function pickSource(sources: { src: string; type: string }[]) {
  const probe = document.createElement('video')
  return (
    sources.find((s) => probe.canPlayType(s.type) === 'probably') ??
    sources.find((s) => probe.canPlayType(s.type)) ??
    sources[0]
  )
}

/**
 * Pulls the clip through `fetch` once, purely so the service worker keeps a copy.
 *
 * A video element asks for its file with a `Range` header, and a ranged media
 * request does not end up in the runtime cache: measured on a production build,
 * `resona-turntables` was still empty after a full playthrough of TV mode, while
 * one plain fetch of the same URL filled it. What was holding the clip instead
 * was the browser's own HTTP cache, which is evictable and is not what an
 * offline-first app should be resting on. Cache Storage is.
 *
 * It runs alongside playback rather than before it, so the first frame still
 * appears while the file streams. That costs the bytes twice on the very first
 * viewing and nothing on every viewing after.
 */
function warm(url: string) {
  if (warmed.has(url)) return
  warmed.add(url)
  fetch(url)
    .then((r) => r.arrayBuffer())
    .catch(() => warmed.delete(url))
}

type Props = {
  /** Candidates; only the one this browser can decode is ever requested. */
  sources: { src: string; type: string }[]
  playing: boolean
  className?: string
}

export function TurntableField({ sources, playing, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const style = useSession((s) => s.config.style)
  const pace = useSession((s) => s.config.pace)

  // The rate is the whole idea, so it is derived rather than baked in.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const musicalPeriod = () => {
      if (!playing) return IDLE_TURN_SECONDS
      if (style && style !== 'ambient') {
        // Sixteen bars of four beats, at whatever tempo the style is running.
        return (BARS_PER_TURN * 4 * 60) / clubBpm(style, pace)
      }
      // `leadInterval` in GenerativeMelody — the interval everything rhythmic
      // on the ambient engine follows. Kept in step with it by hand, which is
      // why it is named here rather than being a bare number.
      const leadInterval = 1.5 - pace * 1.12
      return NOTES_PER_TURN * leadInterval
    }

    const period = Math.min(
      SLOWEST_TURN_SECONDS,
      Math.max(FASTEST_TURN_SECONDS, musicalPeriod()),
    )
    const clip = video.duration || 5.04
    video.playbackRate = Math.min(MAX_RATE, Math.max(MIN_RATE, clip / period))
    // Development only, beside `window.__audio`: what the figure is doing and
    // why, in one object. Worth keeping — it is what caught a measurement of
    // this very effect that was reading a duplicate store left behind by a hot
    // reload, and reporting that the rate never changed when it always had.
    if (import.meta.env.DEV) {
      ;(window as unknown as { __turn?: unknown }).__turn = {
        style,
        pace,
        playing,
        secondsPerTurn: +period.toFixed(1),
        rate: video.playbackRate,
      }
    }
  }, [style, pace, playing])

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let raf = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const chosen = pickSource(sources)
    if (chosen) {
      video.src = chosen.src
      warm(chosen.src)
    }

    void video.play().catch(() => {
      /* autoplay of a muted, sourceless-audio element is allowed; if a platform
         refuses anyway the canvas simply holds the last frame it decoded */
    })

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const w = canvas.width
      const h = canvas.height
      if (!w || !h) return
      if (video.readyState < 2) return

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      // Contain-fit, the same 94% as the still figures so the two sit at the
      // same size when the stage switches between them.
      const vw = video.videoWidth || 1
      const vh = video.videoHeight || 1
      const fit = Math.min((h * 0.94) / vh, (w * 0.94) / vw)
      const dw = vw * fit
      const dh = vh * fit
      const dx = (w - dw) / 2
      const dy = (h - dh) / 2

      // Ambient wash: the frame again, blown up and blurred, so the figure
      // throws colour onto the room rather than sitting on a black rectangle.
      ctx.save()
      ctx.globalAlpha = 0.34
      ctx.filter = 'blur(38px)'
      ctx.drawImage(video, dx - dw * 0.16, dy - dh * 0.1, dw * 1.32, dh * 1.2)
      ctx.restore()
      ctx.filter = 'none'

      const wave = playing ? engine.getWaveform() : null
      if (!wave || reducedMotion) {
        ctx.drawImage(video, dx, dy, dw, dh)
        return
      }

      // Shear: each strip is offset by the waveform sample at its height, so a
      // loud passage ripples the figure and a quiet one leaves it still.
      const stripSrc = vh / STRIPS
      const stripDst = dh / STRIPS
      for (let i = 0; i < STRIPS; i++) {
        const sample = wave[Math.floor((i / STRIPS) * wave.length)] ?? 0
        const shift = sample * dw * 0.045
        ctx.drawImage(
          video,
          0,
          i * stripSrc,
          vw,
          stripSrc,
          dx + shift,
          dy + i * stripDst,
          dw,
          stripDst + 1, // +1 so rounding never leaves a seam between strips
        )
      }
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      // Releasing the decoder matters here in a way it does not for an image:
      // left attached, it keeps decoding behind whatever is on screen next.
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [sources, playing, reducedMotion])

  return (
    <div className={className}>
      <canvas ref={canvasRef} className="h-full w-full" />
      <video
        ref={videoRef}
        className="hidden"
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden
      />
    </div>
  )
}
