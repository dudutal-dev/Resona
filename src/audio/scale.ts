/**
 * Anchoring (§4.1) — the idea the whole app rests on.
 *
 * The chosen frequency is not a tone parked next to the music; it is the
 * fundamental the music is derived from. Every pitch the melody can play is
 * `root * justIntonationRatio * 2^octave`, so no note exists that isn't a whole
 * harmonic relation of the target frequency.
 */

/** Just intonation major scale — pure integer ratios, not equal temperament. */
export const JUST_MAJOR = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8] as const

/** Softer, more open set used for sleep and low roots — no leading tone. */
export const JUST_PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3] as const

/** Minor-leaning set for the darker roots. */
export const JUST_MINOR_PENTATONIC = [1, 6 / 5, 4 / 3, 3 / 2, 9 / 5] as const

export type ScaleName = 'major' | 'pentatonic' | 'minorPentatonic'

export const SCALES: Record<ScaleName, readonly number[]> = {
  major: JUST_MAJOR,
  pentatonic: JUST_PENTATONIC,
  minorPentatonic: JUST_MINOR_PENTATONIC,
}

/**
 * Builds the full playable pitch set for a root, spread across octaves and
 * folded into an audible, musical register.
 */
export function buildScale(
  root: number,
  scale: readonly number[] = JUST_MAJOR,
  octaves: readonly number[] = [-2, -1, 0, 1],
): number[] {
  const out: number[] = []
  for (const oct of octaves) {
    for (const ratio of scale) {
      out.push(root * ratio * Math.pow(2, oct))
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * Shifts a frequency by whole octaves until it lands inside [min, max].
 * Octave transposition preserves the harmonic identity of the root exactly.
 */
export function foldToRange(hz: number, min = 90, max = 1400): number {
  if (hz <= 0) return min
  let f = hz
  while (f < min) f *= 2
  while (f > max) f /= 2
  return f
}

/** Every pitch a melody may use, already folded into a comfortable register. */
export function playableScale(root: number, scale: readonly number[]): number[] {
  const raw = buildScale(root, scale)
  const folded = raw.map((f) => foldToRange(f, 110, 1200))
  // De-duplicate near-identical pitches produced by folding.
  const unique: number[] = []
  for (const f of folded.sort((a, b) => a - b)) {
    if (!unique.some((u) => Math.abs(u - f) < 0.5)) unique.push(f)
  }
  return unique
}

/**
 * Weighted Markov walk over scale degrees (§4.3). Small steps are far more
 * likely than leaps, which keeps the line singable, while the randomness means
 * no two listening sessions produce the same sequence — the direct answer to
 * the "I know every track by heart after a month" complaint.
 */
export function nextDegree(current: number, size: number, rand: () => number = Math.random): number {
  const steps = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
  const weights = [1, 2, 5, 9, 3, 9, 5, 2, 1]
  const total = weights.reduce((a, b) => a + b, 0)
  let pick = rand() * total
  let step = 0
  for (let i = 0; i < steps.length; i++) {
    pick -= weights[i]
    if (pick <= 0) {
      step = steps[i]
      break
    }
  }
  let next = current + step
  // Reflect at the edges instead of clamping, so the line turns around rather
  // than sticking to the top or bottom of the range.
  if (next < 0) next = Math.abs(next)
  if (next >= size) next = size - 1 - (next - size + 1)
  return Math.max(0, Math.min(size - 1, next))
}

/**
 * Carrier pitch for the beat layer, derived from the root so the binaural tone
 * is consonant with the melody instead of clashing with it.
 */
export function carrierFor(root: number): number {
  return foldToRange(root, 110, 240)
}

/** Chooses a scale colour appropriate to the register of the root. */
export function scaleForRoot(root: number): ScaleName {
  if (root <= 300) return 'minorPentatonic'
  if (root <= 500) return 'pentatonic'
  return 'major'
}
