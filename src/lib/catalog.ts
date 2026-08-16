import frequenciesRaw from '../data/frequencies.json'
import journeysRaw from '../data/journeys.json'
import type { Frequency, Journey, JourneyPurpose, TrustLevel } from './types'

export const FREQUENCIES = frequenciesRaw as Frequency[]
export const JOURNEYS = journeysRaw as Journey[]

const BY_ID = new Map(FREQUENCIES.map((f) => [f.id, f]))

export function getFrequency(id: string): Frequency | undefined {
  return BY_ID.get(id)
}

/** Frequencies usable as a melodic root — everything with a concrete Hz value. */
export const ROOT_FREQUENCIES = FREQUENCIES.filter(
  (f): f is Frequency & { hz: number } => typeof f.hz === 'number',
)

/**
 * Root frequencies split by what they are, not by pitch. The solfeggio set and
 * the 432 tuning carry different stories and shouldn't read as one list.
 */
export const ROOT_GROUPS: { id: string; title: string; note: string; items: Frequency[] }[] = [
  {
    id: 'solfeggio',
    title: 'סולם הסולפג׳יו',
    note: 'תשעה תדרים מהמסורת, מהנמוך לגבוה',
    items: FREQUENCIES.filter((f) => f.type === 'solfeggio'),
  },
  {
    id: 'tuning',
    title: 'כוונון חלופי',
    note: 'כוונון מוזיקלי במקום 440Hz הסטנדרטי',
    items: FREQUENCIES.filter((f) => f.type === 'tuning'),
  },
]

/** Frequencies usable as a brainwave beat — everything with a range. */
export const BEAT_FREQUENCIES = FREQUENCIES.filter(
  (f): f is Frequency & { range: [number, number] } => Array.isArray(f.range),
)

export function getJourney(id: string): Journey | undefined {
  return JOURNEYS.find((j) => j.id === id)
}

/**
 * The transparency notice mandated by §5.1 of the spec. Every frequency shown in
 * the UI carries the sentence matching its `trust` level — no exceptions.
 */
export const TRUST_NOTICE: Record<TrustLevel, string> = {
  traditional: 'מבוסס מסורת ואמונה תרבותית ואינו נתמך בראיות מדעיות קליניות.',
  research_backed_partial: 'קיימות ראיות מחקריות חלקיות ולא עקביות.',
}

export const TRUST_SHORT: Record<TrustLevel, string> = {
  traditional: 'מסורתי',
  research_backed_partial: 'ראיות חלקיות',
}

export const PURPOSE_LABEL: Record<JourneyPurpose, string> = {
  sleep: 'שינה',
  focus: 'ריכוז',
  spiritual: 'רוחני',
  anxiety: 'חרדה',
  intro: 'התחלה',
  energy: 'אנרגיה',
  creativity: 'יצירתיות',
  body: 'גוף',
  rhythm: 'קצבי',
  psychedelic: 'פסיכדלי',
  work: 'עבודה',
  intimacy: 'זוגיות',
  club: 'טכנו וטראנס',
}

/**
 * A journey day resolves to a root + optional beat. Binaural days still need a
 * musical root so the melody has a fundamental to be composed around; we pair
 * each band with a matching solfeggio tone rather than leaving the day silent.
 */
export const BAND_MUSICAL_ROOT: Record<string, string> = {
  'bb-delta': 'sol-174',
  'bb-theta': 'sol-396',
  'bb-alpha': 'sol-432',
  'bb-beta': 'sol-741',
  'bb-gamma': 'sol-852',
}

/**
 * The brainwave band that supports a journey day when the day itself prescribes
 * a solfeggio tone. Chosen per purpose so the added layer argues for the same
 * state the journey is already aiming at, rather than being decoration.
 */
export const PURPOSE_BAND: Record<JourneyPurpose, string> = {
  sleep: 'bb-delta',
  anxiety: 'bb-alpha',
  focus: 'bb-beta',
  spiritual: 'bb-theta',
  intro: 'bb-alpha',
  energy: 'bb-beta',
  creativity: 'bb-theta',
  body: 'bb-theta',
  rhythm: 'bb-beta',
  psychedelic: 'bb-theta',
  work: 'bb-beta',
  intimacy: 'bb-alpha',
  club: 'bb-beta',
}

/** Middle of a band's range — the default beat rate when a band is picked. */
export function defaultBeatHz(f: Frequency): number {
  if (!f.range) return 6
  const [lo, hi] = f.range
  return Math.round(((lo + hi) / 2) * 10) / 10
}
