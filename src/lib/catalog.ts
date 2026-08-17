import frequenciesRaw from '../data/frequencies.json'
import journeysRaw from '../data/journeys.json'
import type {
  ClubStyle,
  Frequency,
  FrequencyType,
  Journey,
  JourneyDay,
  JourneyPurpose,
  MelodyStyle,
  TrustLevel,
} from './types'
import type { Lang, StringKey } from './i18n'

export const FREQUENCIES = frequenciesRaw as Frequency[]
export const JOURNEYS = journeysRaw as Journey[]

const BY_ID = new Map(FREQUENCIES.map((f) => [f.id, f]))

/**
 * Catalogue text in the current language.
 *
 * The English fields sit alongside the Hebrew ones in the same JSON entry
 * rather than in a parallel file. A parallel file drifts: someone adds a
 * journey to one and not the other, and the app half-translates itself. Here a
 * new entry cannot compile without both.
 */
export const freqLabel = (f: Frequency, lang: Lang) => (lang === 'en' ? f.labelEn : f.label)
export const freqInfo = (f: Frequency, lang: Lang) => (lang === 'en' ? f.infoEn : f.info)
export const journeyTitle = (j: Journey, lang: Lang) => (lang === 'en' ? j.titleEn : j.title)
export const journeyDescription = (j: Journey, lang: Lang) =>
  lang === 'en' ? j.descriptionEn : j.description
export const dayNote = (d: JourneyDay, lang: Lang) => (lang === 'en' ? d.noteEn : d.note)

/**
 * A band's short name, for places that show it inline — "Theta", not
 * "Theta — deep relaxation and meditation". Both languages use an em dash to
 * separate the name from its description.
 */
export const shortLabel = (f: Frequency, lang: Lang) => freqLabel(f, lang).split('—')[0].trim()

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
export const ROOT_GROUPS: {
  id: string
  titleKey: StringKey
  noteKey: StringKey
  items: Frequency[]
}[] = [
  {
    id: 'solfeggio',
    titleKey: 'freq.group.solfeggio',
    noteKey: 'freq.group.solfeggioNote',
    items: FREQUENCIES.filter((f) => f.type === 'solfeggio'),
  },
  {
    id: 'tuning',
    titleKey: 'freq.group.tuning',
    noteKey: 'freq.group.tuningNote',
    items: FREQUENCIES.filter((f) => f.type === 'tuning'),
  },
  {
    id: 'cosmic',
    titleKey: 'freq.group.cosmic',
    noteKey: 'freq.group.cosmicNote',
    items: FREQUENCIES.filter((f) => f.type === 'cosmic'),
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
 * §5.1 requires every frequency to carry the sentence matching its trust level
 * wherever it appears. These build dictionary keys rather than holding the text,
 * so the sentence follows the interface language and a missing translation is a
 * compile error rather than a Hebrew line on an English screen.
 */
export const trustNoticeKey = (t: TrustLevel): StringKey => `trust.${t}.notice`
export const trustShortKey = (t: TrustLevel): StringKey => `trust.${t}`
export const styleKey = (s: MelodyStyle): StringKey => `style.${s}`
export const styleNoteKey = (s: ClubStyle): StringKey => `style.${s}.note`
export const purposeKey = (p: JourneyPurpose): StringKey => `purpose.${p}`
export const typeKey = (t: FrequencyType): StringKey => `type.${t}`

/**
 * A journey day resolves to a root + optional beat. Binaural days still need a
 * musical root so the melody has a fundamental to be composed around; we pair
 * each band with a matching solfeggio tone rather than leaving the day silent.
 */
export const BAND_MUSICAL_ROOT: Record<string, string> = {
  'bb-delta': 'sol-174',
  'bb-theta': 'sol-396',
  'bb-schumann': 'sol-432',
  'bb-alpha': 'sol-432',
  'bb-smr': 'sol-528',
  'bb-beta': 'sol-741',
  'bb-gamma': 'sol-852',
  'bb-gamma40': 'sol-963',
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

/**
 * The rate a band starts at — its own declared value where it has one, and
 * otherwise the middle of its range. Schumann is the reason for the override:
 * the band is deliberately wide enough to be usable, but the number people
 * come for is 7.83, not the midpoint of the window around it.
 */
export function defaultBeatHz(f: Frequency): number {
  if (!f.range) return 6
  const [lo, hi] = f.range
  const raw = f.defaultHz ?? (lo + hi) / 2
  return Math.min(hi, Math.max(lo, Math.round(raw * 100) / 100))
}
