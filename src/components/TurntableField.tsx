import { useEffect, useRef } from 'react'
import { warmMedia } from '../lib/mediaCache'
import { engine } from '../audio/ToneEngine'
import { HOLD_NOTES, POSES, TURN_NOTES, noteSeconds } from '../lib/turnClock'
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

/** What browsers accept for a playback rate. */
const MIN_RATE = 0.0625
/**
 * The fastest a turn is allowed to run. Well under what the element would
 * accept: past this the figure stops reading as turning and starts reading as
 * being scrubbed, and the overshoot per frame grows with it.
 */
const TURN_MAX_RATE = 1.15


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

  /**
   * The figure turns to somewhere and stays there, on the music's events.
   *
   * The first version rotated at a constant rate derived from the tempo. That
   * was correct and boring: a steady spin has nothing in it to notice, and
   * after a minute it reads as a screensaver. What a person actually watches is
   * a figure that turns when something happens and then holds — facing out,
   * mostly, because a figure looking at you is the reason to have one.
   *
   * So the rate is no longer set once and left. Each frame it is computed from
   * the distance to the pose the figure is heading for: far away it runs, close
   * up it eases, and at the pose it is zero and the video is genuinely paused
   * on a frame. Driving the rate rather than scrubbing `currentTime` matters —
   * scrubbing every frame makes the decoder seek, which stutters; letting it
   * play forward slowly is what it is built for.
   *
   * What starts a turn is `engine.pulse.phrases`, which the melody bumps when it
   * begins a new run of notes and the club engine bumps every four bars. That is
   * the difference between moving *with* the music and moving *at the same
   * time as* it.
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let raf = 0
    let poseIndex = 0
    let target = 0
    let lastPhrase = -1
    let holdUntil = 0
    let lastFrame = performance.now()

    const step = () => {
      raf = requestAnimationFrame(step)
      const clip = video.duration || 24
      const now = performance.now()
      const dt = Math.min(0.1, (now - lastFrame) / 1000)
      lastFrame = now

      const note = noteSeconds({ playing, style, pace })
      const phrase = engine.pulse.phrases

      // A new phrase, and the current pose has been held long enough, means it
      // is time to move. The minimum hold is what stops a busy passage from
      // shaking the figure.
      if (phrase !== lastPhrase && now >= holdUntil) {
        lastPhrase = phrase
        // Always forward: a turntable turns one way, and a figure that
        // reverses direction reads as a glitch rather than as a choice.
        poseIndex = (poseIndex + 1 + Math.floor(Math.random() * 2)) % POSES.length
        target = POSES[poseIndex] * clip
        const held = poseIndex === 0 ? HOLD_NOTES.front : HOLD_NOTES.other
        holdUntil = now + (TURN_NOTES + held) * note * 1000
      } else if (phrase !== lastPhrase) {
        lastPhrase = phrase
      }

      // Distance the short way round, always forwards.
      const at = video.currentTime % clip
      const ahead = (target - at + clip) % clip

      /**
       * Arrival, and the overshoot that made the first version never stop.
       *
       * The element plays on between animation frames, so it can pass the pose
       * inside one — and "distance forwards to the target" then reads as almost
       * a whole revolution rather than as a small miss. The figure would set off
       * to chase it the long way round, at which point it never held anything
       * and the rate sat pinned near its maximum: exactly the constant spin this
       * was written to replace, arrived at from the other direction.
       *
       * So the window scales with how fast it is moving, and anything just
       * *behind* the pose counts as arrived and is snapped onto it. One seek of
       * a few hundredths of a second, once per pose, is not visible; a figure
       * that never stops very much is.
       */
      /**
       * The last fraction of a second is snapped rather than crawled.
       *
       * Approaching the pose asymptotically looks right and never actually
       * stops: measured, the figure spent the whole time between phrases
       * creeping through the final tenth of a second of clip, which is a figure
       * slowing down, not a figure at rest. Three tenths of a second of a
       * twenty-four second revolution is under five degrees — nobody sees it
       * jump, and everybody sees it stop.
       */
      const eps = Math.max(0.3, video.playbackRate * 0.1)
      if (ahead <= eps) {
        if (Math.abs(at - target) > 0.02) video.currentTime = target
        video.playbackRate = MIN_RATE
        if (!video.paused) video.pause()
      } else if (ahead >= clip - eps * 2) {
        video.currentTime = target
        video.playbackRate = MIN_RATE
        if (!video.paused) video.pause()
      } else {
        if (video.paused) void video.play().catch(() => {})
        // Cover the remaining distance in the time a turn is allowed, and never
        // faster than the eye can follow it.
        const wanted = ahead / Math.max(0.4, TURN_NOTES * note)
        video.playbackRate = Math.min(TURN_MAX_RATE, Math.max(MIN_RATE, wanted))
      }

      if (import.meta.env.DEV) {
        ;(window as unknown as { __turn?: unknown }).__turn = {
          style,
          pace,
          playing,
          pose: POSES[poseIndex],
          atFraction: +(at / clip).toFixed(3),
          aheadSeconds: +ahead.toFixed(2),
          rate: +video.playbackRate.toFixed(3),
          holding: video.paused,
          phrases: phrase,
        }
      }
      void dt
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
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
    warmMedia(src)

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
