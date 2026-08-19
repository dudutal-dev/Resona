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
export const MELODY_STYLES = ['ambient', 'techno', 'trance', 'psytrance', 'deephouse'] as const

export type MelodyStyle = (typeof MELODY_STYLES)[number]

/** Everything driven by the grid — that is, everything but ambient. */
export type ClubStyle = Exclude<MelodyStyle, 'ambient'>

export const CLUB_STYLES = MELODY_STYLES.filter((s): s is ClubStyle => s !== 'ambient')

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
