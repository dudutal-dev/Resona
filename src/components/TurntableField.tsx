import { useEffect, useRef } from 'react'
import { engine } from '../audio/ToneEngine'
import { turnRate, turnSeconds } from '../lib/turnClock'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'

/**
 * A figure making one revolution, turning on the music's own clock.
 *
 * The clip is one revolution of a locked-camera turntable, encoded at
 * twenty-four seconds so the usual rates land near 1 and it runs at its own
 * frame rate — see `pack-turntables.mjs`. Left alone it would be a loop at whatever
 * speed it was shot at, which is wallpaper. What makes it belong to this app is
 * that the rate is derived from what is actually sounding, which is exactly
 * how long a revolution takes — see `turnClock`, which both this and the cast
 * route read so the two cannot drift apart.
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

/** Strips the frame is sheared into. Matches `FigureField`. */
const STRIPS = 96

/**
 * URLs already pulled through a plain fetch, so a play/pause cycle does not ask
 * for the same file again.
 */
const warmed = new Set<string>()

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
  /** The cut to play. Swapping it mid-session reloads the element. */
  src: string
  /**
   * A still from the clip, drawn while the video is still arriving. Without it
   * the stage opens on black for as long as the first megabyte takes.
   */
  poster?: string
  playing: boolean
  className?: string
}

export function TurntableField({ src, poster, playing, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const style = useSession((s) => s.config.style)
  const pace = useSession((s) => s.config.pace)

  // The rate is the whole idea, so it is derived rather than baked in.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const period = turnSeconds({ playing, style, pace })
    const clip = video.duration || 24
    video.playbackRate = turnRate(clip, period)
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

    video.src = src
    warm(src)

    // The still, held ready so the stage has something to draw during the
    // first fetch. `drawImage` does not care which of the two it is handed,
    // which is what lets the whole treatment below stay written once.
    let still: HTMLImageElement | null = null
    if (poster) {
      still = new Image()
      still.src = poster
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

      // Whichever of the two is ready. The video wins the moment it can give a
      // frame; before that the poster stands in, so opening the stage on a cold
      // cache shows the figure rather than a black screen for a megabyte.
      const live = video.readyState >= 2
      const source: CanvasImageSource | null = live ? video : still?.complete ? still : null
      if (!source) return

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)

      // Contain-fit, the same 94% as the still figures so the two sit at the
      // same size when the stage switches between them.
      const vw = (live ? video.videoWidth : still?.naturalWidth) || 1
      const vh = (live ? video.videoHeight : still?.naturalHeight) || 1
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
      ctx.drawImage(source, dx - dw * 0.16, dy - dh * 0.1, dw * 1.32, dh * 1.2)
      ctx.restore()
      ctx.filter = 'none'

      const wave = playing && live ? engine.getWaveform() : null
      if (!wave || reducedMotion) {
        ctx.drawImage(source, dx, dy, dw, dh)
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
          source,
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
  }, [src, poster, playing, reducedMotion])

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
