import { JUST_MAJOR } from './scale'

/**
 * Reading the level of each interval of the scale out of the live spectrum.
 *
 * Shared by both visualisers so there is one implementation of the part that
 * was actually hard to get right, and one place holding the constants that were
 * chosen by measurement rather than by eye.
 *
 * The idea: ring `3/2` should answer to the level at `root × 3/2`, so that when
 * the music plays a fifth it is the fifth that lights up. Whether that is true
 * or merely asserted depends entirely on how the spectrum is sampled, and the
 * first attempt at it was wrong in a way that looked fine — see below.
 */

export const RATIOS = JUST_MAJOR
export const MAX_RATIO = RATIOS[RATIOS.length - 1]
export const BAND_COUNT = RATIOS.length

/**
 * Octaves searched per interval, and the window they must land in.
 *
 * A bin is about 21.5 Hz wide. Low down that is more than a semitone, so
 * neighbouring intervals fall in the same bin and the reading stops being about
 * harmony at all: sampling five octaves through a three-bin window scored 0
 * frames out of 260 in which a scale interval read louder than a deliberately
 * off-scale probe. Restricted to these three octaves above 300 Hz, nearest bin
 * only, the scale wins 260 out of 260. The mean margin is about 3 dB — a real
 * bias, not a spectrograph.
 */
const OCTAVES = [0, 1, 2]
const MIN_HZ = 300
const MAX_HZ = 6000

/**
 * The dB window a level maps across, also measured: across 260 frames of real
 * playback the active bins sat between roughly -80 and -48 dB. A wider window
 * leaves every band parked near 0.1 and visually inert; this one produces
 * levels from 0.11 to 0.92 with a mean of 0.35, touching neither rail.
 */
const DB_FLOOR = -80
const DB_RANGE = 36

/** Level at one pitch, taken from the loudest octave it can sound in. */
export function levelAt(spectrum: Float32Array, hz: number, binHz: number): number {
  let best = 0
  for (const octave of OCTAVES) {
    const f = hz * Math.pow(2, octave)
    if (f < MIN_HZ || f > MAX_HZ) continue
    const bin = Math.round(f / binHz)
    if (bin < 0 || bin >= spectrum.length) continue
    const db = spectrum[bin]
    if (!Number.isFinite(db)) continue
    const level = (db - DB_FLOOR) / DB_RANGE
    if (level > best) best = level > 1 ? 1 : level
  }
  return best
}

/** Hz per FFT bin, given the analyser's output length. */
export const binWidth = (sampleRate: number, bins: number) => sampleRate / (2 * bins)

/**
 * Smoothed per-interval levels, with a fast attack and a slow release — the
 * shape of a note rather than of a slider. Writes in place and returns the
 * per-band rise, which is what a transient looks like from here.
 */
export function readBands(
  into: Float32Array,
  rise: Float32Array,
  spectrum: Float32Array | null,
  rootHz: number,
  sampleRate: number,
  idlePhase: number,
): number {
  const binHz = spectrum?.length ? binWidth(sampleRate, spectrum.length) : 1
  let sum = 0
  for (let i = 0; i < BAND_COUNT; i++) {
    const target = spectrum
      ? levelAt(spectrum, rootHz * RATIOS[i], binHz)
      : // Idle: a slow wander, so the picture is alive but visibly not reacting.
        0.12 + Math.sin(idlePhase * 0.7 + i * 0.9) * 0.06
    const previous = into[i]
    into[i] += (target - previous) * (target > previous ? 0.35 : 0.06)
    rise[i] = into[i] - previous
    sum += into[i]
  }
  return sum / BAND_COUNT
}
