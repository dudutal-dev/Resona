import { BAND_MUSICAL_ROOT, defaultBeatHz, getFrequency } from './catalog'
import type { JourneyDay, SessionConfig } from './types'
import { DEFAULT_CONFIG } from '../store/sessionStore'

/**
 * Turns a scheduled journey day into a playable session.
 *
 * A day that prescribes a solfeggio tone plays it as the melodic root with the
 * brainwave layer off. A day that prescribes a brainwave band turns that layer
 * on and pairs it with the band's matching musical root, because the melody
 * still needs a fundamental to be composed around — a band alone has no pitch.
 */
export function configForDay(day: JourneyDay, base: SessionConfig = DEFAULT_CONFIG): SessionConfig {
  const target = getFrequency(day.frequencyId)
  const isBand = !!target?.range

  const rootId = isBand ? (BAND_MUSICAL_ROOT[day.frequencyId] ?? base.rootId) : day.frequencyId
  const beatId = isBand ? day.frequencyId : null

  return {
    ...base,
    rootId,
    beatId,
    beatHz: isBand && target ? defaultBeatHz(target) : base.beatHz,
    timerMode: 'custom',
    customMinutes: day.durationMin,
    levels: {
      ...base.levels,
      // Brainwave days lean on the beat; solfeggio days lean on the melody.
      beat: isBand ? Math.max(base.levels.beat, 0.4) : base.levels.beat,
    },
  }
}
