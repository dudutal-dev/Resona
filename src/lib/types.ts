/**
 * `reference` exists for entries that make no claim at all — the standard
 * A=440 tuning is the reason. Labelling it "tradition-based, unsupported by
 * clinical evidence" would be plainly false, and the transparency guarantee is
 * worth nothing if the badge lies in either direction.
 */
export type TrustLevel = 'traditional' | 'research_backed_partial' | 'reference'

export type FrequencyType = 'solfeggio' | 'tuning' | 'binaural' | 'cosmic'

/** A single entry from `data/frequencies.json`. */
export type Frequency = {
  id: string
  type: FrequencyType
  /** Present for solfeggio / tuning entries — the exact root pitch in Hz. */
  hz?: number
  /** Present for binaural entries — the [min, max] beat range in Hz. */
  range?: [number, number]
  /**
   * Rate to start a band at, when the middle of its range is not the point.
   * Schumann is the case that needs it: the band is wide enough to be usable,
   * but the value people mean is 7.83.
   */
  defaultHz?: number
  label: string
  /** English label. Required — see `catalog.test.ts`. */
  labelEn: string
  trust: TrustLevel
  info: string
  infoEn: string
  /** Base hue (0-360) used to tint the UI when this frequency is selected. */
  hue: number
}

/**
 * Which engine composes the melody. Not a continuum — `ambient` refuses to
 * repeat, the club styles are built on a grid, and they use different voices.
 *
 * Declared as a list first so the picker, the journey data and the tests all
 * read from one place; adding a style in one of them and forgetting the others
 * is the mistake this prevents.
 */
export const MELODY_STYLES = [
  'ambient',
  'plucked',
  'techno',
  'trance',
  'psytrance',
  'deephouse',
  'organichouse',
  'trippy',
] as const

export type MelodyStyle = (typeof MELODY_STYLES)[number]

/** Everything driven by the grid — that is, everything but ambient. */
/**
 * The styles built on a grid. Defined by exclusion rather than by listing, so a
 * new free style cannot be added without deciding which side of this line it
 * falls on — `organic` is the reason this now excludes two things instead of
 * one, and getting it wrong would have handed a kick and a hi-hat to a texture
 * that is supposed to have neither.
 */
export type ClubStyle = Exclude<MelodyStyle, FreeStyle>

/** Free styles: no tempo, no grid, no club voices. */
export const FREE_STYLES = ['ambient', 'plucked'] as const
export type FreeStyle = (typeof FREE_STYLES)[number]
export const isClubStyle = (s: MelodyStyle | undefined): s is ClubStyle =>
  s !== undefined && !(FREE_STYLES as readonly string[]).includes(s)

/**
 * `organic` was the id the plucked style shipped under for one release, on a
 * misreading: what was asked for was organic deep house, which is a club genre
 * and is now its own entry. Saved sessions and a catalogue journey still name
 * the old id, so it is mapped rather than broken.
 */
export const LEGACY_STYLE_IDS: Record<string, MelodyStyle> = { organic: 'plucked' }
export const migrateStyle = (s: string | undefined): MelodyStyle | undefined =>
  s === undefined ? undefined : (LEGACY_STYLE_IDS[s] ?? (s as MelodyStyle))

export const CLUB_STYLES = MELODY_STYLES.filter(isClubStyle)

export type JourneyPurpose =
  | 'sleep'
  | 'focus'
  | 'spiritual'
  | 'anxiety'
  | 'intro'
  | 'energy'
  | 'creativity'
  | 'body'
  | 'rhythm'
  | 'psychedelic'
  | 'work'
  | 'intimacy'
  | 'club'

/**
 * One step of a journey.
 *
 * The interface calls these **stages**, not days, because nothing in the app
 * enforces one a day — three in an evening is allowed and common, and "day 3"
 * was a promise the app never kept. The type and the stored progress keep the
 * older name: renaming them would mean migrating every saved `completedDays`
 * and `currentDay` in everyone's browser to change a word nobody reads. The
 * word lives in `common.stageN` and friends, which is the only place it is
 * displayed from.
 */
export type JourneyDay = {
  day: number
  frequencyId: string
  durationMin: number
  note: string
  noteEn: string
  /** Overrides the session pace for this day. Omit to keep the user's setting. */
  pace?: number
  /**
   * Brainwave band to run underneath a solfeggio day. Omit to take the band
   * that matches the journey's purpose.
   */
  beatId?: string
  /**
   * Rate for that band, in Hz. Omit to take the band's own default.
   *
   * Delta is the reason this exists: the band spans 0.5 to 4Hz, and without a
   * per-day rate every delta night in every journey runs at its midpoint. For a
   * sleep journey that removes the only progression that matters — descending
   * through the band night after night — and leaves seven identical nights
   * wearing seven different titles. Clamped into the band's range.
   */
  beatHz?: number
  /** Overrides the session depth for this day. */
  depth?: number
  /**
   * Overrides note density. Low values leave long gaps, which is what makes a
   * session usable as background for work rather than something you listen to.
   */
  density?: number
  /** Melody engine for this day. Omit for the ambient one. */
  style?: MelodyStyle
}

export type Journey = {
  id: string
  title: string
  titleEn: string
  days: number
  purpose: JourneyPurpose
  description: string
  descriptionEn: string
  /**
   * Declares that the journey's roots move in one direction across its days.
   * Tested when present, so a schedule edit cannot silently break the arc.
   */
  arc?: 'ascending' | 'descending'
  schedule: JourneyDay[]
}

/**
 * The fixed set from the spec, plus `custom`. Journey days prescribe exact
 * lengths (20, 25, 45, 90 minutes) that the fixed presets cannot express, and
 * silently rounding a prescribed duration would misrepresent the schedule.
 */
export type TimerMode = '15' | '30' | '60' | '120' | 'untilMorning' | 'unlimited' | 'custom'

/** How the brainwave layer is rendered: true stereo binaural, or speaker-safe isochronic. */
export type BeatMode = 'binaural' | 'isochronic'

export type BuiltInAmbienceId = 'none' | 'rain' | 'ocean' | 'white' | 'pink' | 'brown' | 'wind'

/**
 * Built-in ambiences are synthesised, so they cost no bandwidth and never end.
 * A plain string is also accepted: any file listed in
 * `public/audio/ambience/manifest.json` is offered alongside them.
 */
export type AmbienceId = BuiltInAmbienceId | (string & {})

export type MixerLevels = {
  melody: number
  beat: number
  ambience: number
  master: number
}

/** Everything needed to reproduce a listening session exactly. */
export type SessionConfig = {
  /** Root frequency id — a solfeggio/tuning entry drives the melody's fundamental. */
  rootId: string
  /** Brainwave band id, or null when the beat layer is off. */
  beatId: string | null
  /** Chosen beat rate in Hz, clamped into the band's range. */
  beatHz: number
  beatMode: BeatMode
  ambience: AmbienceId
  levels: MixerLevels
  timerMode: TimerMode
  /** Length in minutes when `timerMode` is `custom`. */
  customMinutes?: number
  /** Musical density of the generative melody, 0 (sparse) - 1 (flowing). */
  density: number
  /** Rhythmic character, 0 (drifting ambient) - 1 (a steady walkable pulse). */
  pace: number
  /** Psychedelic character, 0 (grounded) - 1 (swirling, upper-harmonic scale). */
  depth: number
  /** Which melody engine composes the session. */
  style: MelodyStyle
  /**
   * Low-shelf gain in decibels, applied to the whole mix under 120Hz. Zero is
   * flat and is the default, so a session that never touches it sounds exactly
   * as it did before this existed. See `BASS_HZ` in `ToneEngine` for why the
   * corner sits where it does.
   */
  bass: number
}

/** Persisted preset. `layers` matches the schema in the build spec (§5.3). */
export type Preset = {
  id: string
  name: string
  layers: { frequencyId: string; volume: number }[]
  ambienceTrack?: string
  timerMode: TimerMode
  createdAt: string
  /** Full config so a preset reloads bit-for-bit, not just approximately. */
  config: SessionConfig
}

export type MoodScore = 1 | 2 | 3 | 4 | 5

export type JourneyProgress = {
  journeyId: string
  currentDay: number
  completedDays: number[]
  startedAt: string
  dailyMood?: Record<number, MoodScore>
}
