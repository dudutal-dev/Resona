import { JOURNEYS } from './catalog'
import type { Journey, JourneyPurpose } from './types'

/**
 * Purposes are fine-grained — good for choosing a supporting band, too many to
 * browse by. Themes are the shelf a person actually looks on: someone wants
 * "something for the evening", not "the anxiety purpose specifically".
 */
export type JourneyTheme = 'start' | 'rest' | 'work' | 'motion' | 'inner' | 'psychedelic'

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

  psychedelic: 'psychedelic',
}

export const THEME_ORDER: JourneyTheme[] = ['start', 'rest', 'work', 'motion', 'inner', 'psychedelic']

export const THEME_LABEL: Record<JourneyTheme, string> = {
  start: 'התחלה',
  rest: 'שינה ורוגע',
  work: 'ריכוז ועבודה',
  motion: 'תנועה וקצב',
  inner: 'פנימי',
  psychedelic: 'פסיכדלי',
}

export const THEME_BLURB: Record<JourneyTheme, string> = {
  start: 'הכי קצר להתחיל ממנו',
  rest: 'להוריד הילוך, להירדם, לשחרר מתח',
  work: 'להאזנה תוך כדי עבודה, ולהרמת אנרגיה',
  motion: 'פעימה קבועה — להליכה, למתיחות, לעמידה',
  inner: 'מדיטציה, התבוננות ויצירה',
  psychedelic: 'הדים ארוכים ומרווחים לא מוכרים',
}

export const THEME_HUE: Record<JourneyTheme, number> = {
  start: 165,
  rest: 258,
  work: 214,
  motion: 96,
  inner: 292,
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
