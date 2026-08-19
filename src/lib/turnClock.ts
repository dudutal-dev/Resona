import { clubBpm } from '../audio/ClubGroove'
import { isClubStyle, type MelodyStyle } from './types'

/**
 * How long one revolution of the figure should take, derived from the music.
 *
 * Pulled out of `TurntableField` when the figure gained a second place to run:
 * cast to a television, the picture is a plain video element on the receiver
 * rather than a canvas on the phone, but it is still supposed to turn on the
 * same clock. Two copies of this arithmetic would have drifted apart the first
 * time either was touched.
 *
 *  - On a **club engine** there is a real tempo, so a revolution takes sixteen
 *    bars of it. The turn completes on a phrase boundary rather than drifting
 *    against one — at 126 BPM that is a little over half a minute.
 *  - On the **ambient engine** there is no grid, but there is a note interval,
 *    which is the one number everything rhythmic there follows. A revolution
 *    takes `NOTES_PER_TURN` of those.
 *
 * An earlier version locked it to the brainwave rate instead. That was a nicer
 * idea on paper than in a room: theta at 6Hz came out at eight seconds a turn,
 * which reads as a figure spinning rather than a figure turning.
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

export function turnSeconds({
  playing,
  style,
  pace,
}: {
  playing: boolean
  style: MelodyStyle | undefined
  pace: number
}): number {
  const musical = () => {
    if (!playing) return IDLE_TURN_SECONDS
    if (isClubStyle(style)) {
      // Sixteen bars of four beats, at whatever tempo the style is running.
      return (BARS_PER_TURN * 4 * 60) / clubBpm(style, pace)
    }
    // Organic has no tempo either, so it turns on the note interval like
    // ambient does.
    // `leadInterval` in GenerativeMelody — the interval everything rhythmic on
    // the ambient engine follows. Kept in step with it by hand, which is why it
    // is named here rather than being a bare number.
    const leadInterval = 1.5 - pace * 1.12
    return NOTES_PER_TURN * leadInterval
  }
  return Math.min(SLOWEST_TURN_SECONDS, Math.max(FASTEST_TURN_SECONDS, musical()))
}

/** The playback rate that makes a clip of `clipSeconds` last one revolution. */
export function turnRate(clipSeconds: number, periodSeconds: number): number {
  return Math.min(MAX_RATE, Math.max(MIN_RATE, (clipSeconds || 24) / periodSeconds))
}

/**
 * Where the figure is allowed to come to rest.
 *
 * A constant rotation is the one thing a person watching for half an hour stops
 * seeing: it has no events in it, so there is nothing to notice. What reads as
 * alive is a figure that turns to somewhere and then stays there — and "stays
 * there" only means anything if the places it stops are chosen rather than
 * wherever the loop happened to be when the music changed.
 *
 * These are fractions of one revolution. Front is 0, and the rest are spaced so
 * that no two adjacent poses are the same view: a three-quarter, a profile, the
 * back, the other profile, the other three-quarter. The clip is one revolution,
 * so a fraction is a fraction of its duration.
 */
export const POSES = [0, 0.14, 0.28, 0.42, 0.5, 0.58, 0.72, 0.86] as const

/**
 * How long the figure holds a pose, and how long it takes to reach the next
 * one, in units of the music's own note interval.
 *
 * Held longer at the front, because that is the pose worth resting on, and the
 * figure looking out of the screen is the whole reason for having a figure.
 */
export const HOLD_NOTES = { front: 9, other: 4 }
export const TURN_NOTES = 3

/** Seconds between lead notes, which is what every duration here is counted in. */
export function noteSeconds({
  playing,
  style,
  pace,
}: {
  playing: boolean
  style: MelodyStyle | undefined
  pace: number
}): number {
  if (!playing) return 2.4
  if (isClubStyle(style)) return (4 * 60) / clubBpm(style, pace)
  return 1.5 - pace * 1.12
}
