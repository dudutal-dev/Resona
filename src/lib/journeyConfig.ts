import { BAND_MUSICAL_ROOT, PURPOSE_BAND, defaultBeatHz, getFrequency } from './catalog'
import type { Journey, JourneyDay, SessionConfig } from './types'
import { DEFAULT_CONFIG } from '../store/sessionStore'

/** Level for a band that supports a day rather than being the day's subject. */
const SUPPORTING_BEAT_LEVEL = 0.22
/** Level for a band that IS the prescribed frequency of the day. */
const PRIMARY_BEAT_LEVEL = 0.4

/**
 * Turns a scheduled journey day into a playable session.
 *
 * Every day runs both layers, which is what makes the headphones/speakers
 * choice mean something on every screen. What changes is which layer is the
 * subject:
 *
 * - A day prescribing a **brainwave band** makes that band primary and pairs it
 *   with the band's matching musical root, because a band has no pitch of its
 *   own and the melody still needs a fundamental to be composed around.
 * - A day prescribing a **solfeggio tone** keeps that tone as the melodic root
 *   and runs a supporting band underneath at a lower level, so the prescribed
 *   frequency stays the thing you are listening to.
 *
 * The supporting band comes from the day if it names one, otherwise from the
 * journey's purpose — a sleep journey leans on delta, a focus journey on beta.
 */
export function configForDay(
  day: JourneyDay,
  journey: Pick<Journey, 'purpose'>,
  base: SessionConfig = DEFAULT_CONFIG,
): SessionConfig {
  const target = getFrequency(day.frequencyId)
  const dayIsBand = !!target?.range

  const rootId = dayIsBand ? (BAND_MUSICAL_ROOT[day.frequencyId] ?? base.rootId) : day.frequencyId
  const beatId = dayIsBand
    ? day.frequencyId
    : (day.beatId ?? PURPOSE_BAND[journey.purpose] ?? 'bb-alpha')

  const beat = getFrequency(beatId)

  return {
    ...base,
    rootId,
    beatId,
    beatHz: beat ? defaultBeatHz(beat) : base.beatHz,
    timerMode: 'custom',
    customMinutes: day.durationMin,
    // Deliberately DEFAULT_CONFIG, not `base`: a guided day has to sound the
    // same whatever was played before it. Falling back to the live session let
    // a psychedelic day's depth leak into the next journey and quietly rewrite
    // its scale.
    pace: day.pace ?? DEFAULT_CONFIG.pace,
    depth: day.depth ?? DEFAULT_CONFIG.depth,
    levels: {
      ...base.levels,
      beat: dayIsBand ? Math.max(base.levels.beat, PRIMARY_BEAT_LEVEL) : SUPPORTING_BEAT_LEVEL,
    },
  }
}

/** The band a day will actually run, for display before the day is started. */
export function bandForDay(day: JourneyDay, journey: Pick<Journey, 'purpose'>) {
  return getFrequency(configForDay(day, journey).beatId ?? '')
}
