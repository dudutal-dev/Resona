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
