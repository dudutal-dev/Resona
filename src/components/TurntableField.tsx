import { useEffect, useRef } from 'react'
import { engine } from '../audio/ToneEngine'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'

/**
 * A figure making one revolution, turning at the rate of the brainwave layer.
 *
 * The clip is five seconds of a locked-camera turntable. Left alone it would be
 * a loop playing at whatever speed it was shot at, which is wallpaper. What
 * makes it belong to this app is that the rate is derived: one full revolution
 * per `TURNS` cycles of the beat frequency, so a 6Hz theta night turns the
 * figure once every eight seconds and a 2Hz delta night takes twenty-four. The
 * thing on screen is running at the rate the session is trying to entrain.
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

/** Revolutions are counted in beat cycles, not seconds. */
const TURNS = 48
/** Kept inside what browsers accept, and inside what looks like turning. */
const MIN_RATE = 0.06
const MAX_RATE = 2

/** Strips the frame is sheared into. Matches `FigureField`. */
const STRIPS = 96

type Props = {
  /** Sources in preference order; the browser downloads only the one it picks. */
  sources: { src: string; type: string }[]
  playing: boolean
  className?: string
}

export function TurntableField({ sources, playing, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const beatHz = useSession((s) => s.config.beatHz)

  // The rate is the whole idea, so it is set from the beat rather than baked in.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const period = beatHz > 0 ? TURNS / beatHz : 12
    const natural = video.duration || 5.04
    const wanted = natural / period
    video.playbackRate = Math.min(MAX_RATE, Math.max(MIN_RATE, wanted))
  }, [beatHz, playing])

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
  }, [playing, reducedMotion])

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
      >
        {sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </video>
    </div>
  )
}
