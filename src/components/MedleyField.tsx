import { useEffect, useRef } from 'react'
import { engine } from '../audio/ToneEngine'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'
import { noteSeconds } from '../lib/turnClock'
import { warmMedia } from '../lib/mediaCache'

/**
 * Every figure in turn, dissolving from one into the next.
 *
 * Built here rather than rendered into a file, and that is the whole design.
 * A pre-cut montage would be another few megabytes to download, it would be
 * the same cuts in the same order every time, and — the part that matters —
 * its transitions would land wherever the editor put them rather than where the
 * music is. This holds each scene until the music finishes a phrase, and
 * changes on that boundary, so a change never cuts across a line.
 *
 * Two elements, stacked, one fading over the other. The one coming in is
 * started and given time to actually produce frames before anything fades: a
 * dissolve into a video that has not decoded yet is a dissolve into black, and
 * black is exactly what a montage must never do.
 */

/**
 * How long a scene holds before the next phrase boundary may replace it.
 *
 * Measured against the thing itself: at the first setting a scene held for
 * about half a minute and the whole cycle took over two, which is not a montage
 * — it is four clips taking turns. Ten to twenty seconds is long enough to
 * settle into a scene and short enough that the change is the point.
 */
const HOLD_NOTES = 14
const HOLD_MIN_SECONDS = 9
const HOLD_MAX_SECONDS = 20
/** The dissolve. Long enough to read as a dissolve, short enough not to muddle. */
const FADE_SECONDS = 1.6
/** Calmed rather than removed: a cut would be harsher than the fade it replaced. */
const REDUCED_FADE_SECONDS = 2.6
const REDUCED_HOLD_MULTIPLIER = 1.8
/** How long to wait for the incoming clip to have frames before giving up on it. */
const READY_TIMEOUT_MS = 4000

export type MedleySource = { src: string; poster?: string }

export function MedleyField({
  sources,
  playing,
  className = '',
}: {
  sources: MedleySource[]
  playing: boolean
  className?: string
}) {
  const layers = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)]
  const style = useSession((s) => s.config.style)
  const pace = useSession((s) => s.config.pace)
  const reducedMotion = useSettings((s) => s.reducedMotion)

  // Everything the loop needs that changes underneath it, read through a ref so
  // the loop itself is started once and never restarted mid-dissolve.
  const live = useRef({ playing, style, pace, reducedMotion, sources })
  live.current = { playing, style, pace, reducedMotion, sources }

  useEffect(() => {
    const [frontRef, backRef] = layers
    const front = frontRef.current
    const back = backRef.current
    if (!front || !back || sources.length === 0) return

    let cancelled = false
    let showing = 0
    let index = 0
    const elements = [front, back]

    const fadeSeconds = () =>
      live.current.reducedMotion ? REDUCED_FADE_SECONDS : FADE_SECONDS

    const holdSeconds = () => {
      const note = noteSeconds({
        playing: live.current.playing,
        style: live.current.style,
        pace: live.current.pace,
      })
      const base = Math.min(HOLD_MAX_SECONDS, Math.max(HOLD_MIN_SECONDS, HOLD_NOTES * note))
      return live.current.reducedMotion ? base * REDUCED_HOLD_MULTIPLIER : base
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

    /** Resolves once the element has decoded enough to show a frame. */
    const hasFrames = async (el: HTMLVideoElement) => {
      const deadline = Date.now() + READY_TIMEOUT_MS
      while (Date.now() < deadline && !cancelled) {
        if (el.readyState >= 2 && el.currentTime > 0) return true
        await sleep(80)
      }
      return el.readyState >= 2
    }

    const prepare = (el: HTMLVideoElement, source: MedleySource) => {
      warmMedia(source.src)
      el.src = source.src
      el.load()
      void el.play().catch(() => {
        /* muted and without an audio track, so this is allowed; if a platform
           refuses, the outgoing layer simply stays up */
      })
    }

    // The first scene is up immediately: this is the stage, not a slideshow
    // waiting to begin.
    front.style.opacity = '1'
    back.style.opacity = '0'
    prepare(front, sources[0])

    const run = async () => {
      while (!cancelled) {
        await sleep(holdSeconds() * 1000)
        if (cancelled) return

        /**
         * Wait for the music to finish what it is saying.
         *
         * `pulse.phrases` is bumped by the melody at the start of a phrase, so
         * watching it change is watching for a boundary rather than guessing at
         * one. With nothing playing there are no phrases, and the wait falls
         * through after a moment so the stage still moves.
         */
        const phrase = engine.pulse.phrases
        const waitUntil = Date.now() + 12_000
        while (
          !cancelled &&
          live.current.playing &&
          engine.pulse.phrases === phrase &&
          Date.now() < waitUntil
        ) {
          await sleep(120)
        }
        if (cancelled) return

        const list = live.current.sources
        if (list.length < 2) continue
        index = (index + 1) % list.length
        const incoming = elements[1 - showing]
        const outgoing = elements[showing]

        prepare(incoming, list[index])
        if (!(await hasFrames(incoming))) {
          // Nothing decoded in time — leave the scene that is working on screen
          // and try the next one at the next boundary.
          continue
        }
        if (cancelled) return

        const seconds = fadeSeconds()
        incoming.style.transition = `opacity ${seconds}s linear`
        outgoing.style.transition = `opacity ${seconds}s linear`
        incoming.style.opacity = '1'
        outgoing.style.opacity = '0'
        await sleep(seconds * 1000 + 120)
        if (cancelled) return

        // The one that has faded out stops decoding until it is needed again.
        outgoing.pause()
        showing = 1 - showing
      }
    }

    void run()
    return () => {
      cancelled = true
      for (const el of elements) el.pause()
    }
    // Deliberately started once. The sources are read through `live`, so adding
    // a figure does not interrupt a dissolve in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The pace of whichever scene is on screen, on the same clock a single clip
  // would use.
  useEffect(() => {
    for (const ref of layers) {
      const el = ref.current
      if (!el) continue
      if (!playing) {
        el.playbackRate = 0.6
        continue
      }
      const note = noteSeconds({ playing, style, pace })
      const pass = el.duration || 9
      el.playbackRate = Math.min(1.35, Math.max(0.5, pass / (9 * note)))
    }
  }, [playing, style, pace])

  return (
    <div className={`relative ${className}`} aria-hidden>
      {layers.map((ref, i) => (
        <video
          key={i}
          ref={ref}
          loop
          muted
          playsInline
          preload="auto"
          poster={sources[0]?.poster}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: i === 0 ? 1 : 0 }}
        />
      ))}
    </div>
  )
}
