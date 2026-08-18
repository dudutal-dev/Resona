import type { StringKey } from './i18n'
import { JOURNEYS } from './catalog'
import type { Journey, JourneyPurpose } from './types'

/**
 * Purposes are fine-grained — good for choosing a supporting band, too many to
 * browse by. Themes are the shelf a person actually looks on: someone wants
 * "something for the evening", not "the anxiety purpose specifically".
 */
export type JourneyTheme =
  | 'start'
  | 'rest'
  | 'work'
  | 'motion'
  | 'inner'
  | 'intimacy'
  | 'psychedelic'
  | 'club'

/** Total by construction, so a new purpose cannot land without a shelf. */
export const THEME_OF: Record<JourneyPurpose, JourneyTheme> = {
  intro: 'start',

  sleep: 'rest',
  anxiety: 'rest',
  body: 'rest',

  focus: 'work',
  work: 'work',
  energy: 'work',

  rhythm: 'motion',

  spiritual: 'inner',
  creativity: 'inner',

  intimacy: 'intimacy',

  psychedelic: 'psychedelic',

  club: 'club',
}

export const THEME_ORDER: JourneyTheme[] = [
  'start',
  'rest',
  'work',
  'motion',
  'inner',
  'intimacy',
  'club',
  'psychedelic',
]

export const themeKey = (t: JourneyTheme): StringKey => `theme.${t}`

export const themeBlurbKey = (t: JourneyTheme): StringKey => `theme.${t}.blurb`

export const THEME_HUE: Record<JourneyTheme, number> = {
  start: 165,
  rest: 258,
  work: 214,
  motion: 96,
  inner: 292,
  intimacy: 345,
  club: 186,
  psychedelic: 310,
}

export function themeOf(journey: Journey): JourneyTheme {
  return THEME_OF[journey.purpose]
}

/** Journeys grouped onto their shelves, in display order, empties dropped. */
export function journeysByTheme(): { theme: JourneyTheme; journeys: Journey[] }[] {
  return THEME_ORDER.map((theme) => ({
    theme,
    journeys: JOURNEYS.filter((j) => THEME_OF[j.purpose] === theme),
  })).filter((g) => g.journeys.length > 0)
}

/**
 * Text set in a frequency's — or a journey's — own hue.
 *
 * The lightness cannot come from the call site. 72% is a lit green on black and
 * an illegible mint on white, and every one of these numbers was written while
 * looking at the dark theme, which is why the light theme's coloured labels sat
 * a shade above the background. Resolving saturation and lightness through
 * custom properties lets the same expression work in all three themes and puts
 * the tuning in one place.
 */
export const hueText = (hue: number) => `hsl(${hue} var(--tint-s) var(--tint-l))`

/**
 * A surface, a hairline and a halo in a given hue.
 *
 * These three appear together everywhere a frequency, a band or a journey gets
 * its own tile, and all three were written as literals tuned against the violet
 * night — 85% saturation, a lit edge, and a 32px bloom behind it. That is
 * correct for one theme out of three. Noir wants the same shapes at half the
 * saturation and with the bloom nearly gone, because a black surface covered in
 * glowing green tiles reads as a console rather than as something expensive;
 * daylight wants more saturation, not less, because chroma is the only thing
 * that survives on white.
 *
 * The call sites keep their own alphas — a chip is fainter than a tile — and
 * the theme scales them. `--halo` at zero removes the bloom entirely.
 */
export const hueFill = (hue: number, alpha = 0.18) =>
  `hsl(${hue} var(--tile-s) var(--tile-l) / calc(${alpha} * var(--tile-a)))`

export const hueLine = (hue: number, alpha = 0.45) =>
  `hsl(${hue} var(--line-s) var(--line-l) / calc(${alpha} * var(--line-a)))`

export const hueGlow = (hue: number, alpha = 0.35) =>
  `hsl(${hue} var(--tile-s) var(--tile-l) / calc(${alpha} * var(--halo)))`
