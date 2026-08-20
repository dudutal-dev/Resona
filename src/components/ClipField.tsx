import { useEffect, useRef } from 'react'
import { useSession } from '../store/sessionStore'
import { noteSeconds } from '../lib/turnClock'
import { warmMedia } from '../lib/mediaCache'

/**
 * Footage that drifts, played as a seamless loop on the music's clock.
 *
 * Not a turntable, and deliberately not drawn through a canvas the way one is.
 * A turntable is a figure revolving against a locked camera, which is why that
 * one is choreographed frame by frame — it has a *position*, and the whole
 * point is which way the figure is facing. This is a camera moving past a
 * scene: it has no pose to hold and nothing to point at, so treating it would
 * only be putting a filter over footage that already carries its own light.
 *
 * What the music does control is the pace. The drift is scaled so that one pass
 * of it lasts about a phrase of whatever is playing — slow music, slow drift —
 * and the loop is closed in the encode rather than here, so nothing has to be
 * faded or cut at the seam. See `pack-clips.mjs`.
 */

/** A pass of the drift lasts about this many lead notes of the music. */
const NOTES_PER_PASS = 9
/** Beyond this it stops reading as a camera and starts reading as a scrub. */
const MIN_RATE = 0.5
const MAX_RATE = 1.35
/** Nothing playing: slower than life, so the stage is never quite still. */
const IDLE_RATE = 0.6

export function ClipField({
  src,
  poster,
  playing,
  className = '',
}: {
  src: string
  poster?: string
  playing: boolean
  className?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const style = useSession((s) => s.config.style)
  const pace = useSession((s) => s.config.pace)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    warmMedia(src)
    void video.play().catch(() => {
      /* a muted, audio-less element is allowed to autoplay; if a platform
         refuses anyway the poster stays up, which is a still of this same
         footage and not a black rectangle */
    })
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!playing) {
      video.playbackRate = IDLE_RATE
      return
    }
    const note = noteSeconds({ playing, style, pace })
    const pass = video.duration || 9
    const rate = pass / (NOTES_PER_PASS * note)
    video.playbackRate = Math.min(MAX_RATE, Math.max(MIN_RATE, rate))
  }, [playing, style, pace])

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      loop
      muted
      playsInline
      autoPlay
      preload="auto"
      aria-hidden
      /**
       * Filled rather than fitted, which on a phone means the sides go.
       *
       * The footage is 16:9 and a phone held upright is not, so something has
       * to be given up: either the scene is a band across the middle of a black
       * screen, or it fills the screen and Jupiter's edges and the far guests
       * are outside the frame. Filling wins on the phone — she is what the clip
       * is of — and on a television the shapes match and nothing is lost at all.
       *
       * (An earlier attempt anchored the crop nearer the top on the theory that
       * her head was being cut. It was not: covering a tall frame with a wide
       * clip crops the sides, not the top, so the setting did nothing.)
       */
      className={`h-full w-full object-cover ${className}`}
    />
  )
}
