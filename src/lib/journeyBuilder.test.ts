import { describe, expect, it } from 'vitest'
import { getFrequency } from './catalog'
import { configForDay } from './journeyConfig'
import {
  BUILDER_DEFAULTS,
  DAY_CHOICES,
  MINUTE_CHOICES,
  buildJourney,
  type BuilderAnswers,
  type BuilderGoal,
  type BuilderShape,
  type BuilderSound,
} from './journeyBuilder'
import { CLUB_STYLES } from './types'

const GOALS: BuilderGoal[] = ['sleep', 'calm', 'focus', 'energy', 'spiritual', 'body', 'club']
const SOUNDS: BuilderSound[] = ['still', 'flowing', 'beat']
const SHAPES: BuilderShape[] = ['ascending', 'descending', 'steady']

/** Every combination the questions can produce. */
function everyAnswer(): BuilderAnswers[] {
  const out: BuilderAnswers[] = []
  for (const goal of GOALS)
    for (const sound of SOUNDS)
      for (const shape of SHAPES)
        for (const days of DAY_CHOICES)
          for (const minutes of MINUTE_CHOICES) out.push({ goal, days, minutes, sound, shape })
  return out
}

const ALL = everyAnswer()

/**
 * The generator has to hold the same rules the hand-written catalogue is tested
 * against. It is the one part of the app that can produce a journey nobody has
 * ever looked at, so these are the only thing standing between a bad answer
 * combination and a week that plays a kick under a sleep journey.
 */
describe('journey builder', () => {
  it('covers a real number of combinations', () => {
    expect(ALL.length).toBe(GOALS.length * SOUNDS.length * SHAPES.length * 5 * 5)
  })

  it('produces the number of days it was asked for', () => {
    for (const a of ALL) {
      const j = buildJourney(a, 'x')
      expect(j.days, JSON.stringify(a)).toBe(a.days)
      expect(j.schedule.length, JSON.stringify(a)).toBe(a.days)
      expect(j.schedule.map((d) => d.day)).toEqual(
        Array.from({ length: a.days }, (_, i) => i + 1),
      )
    }
  })

  it('walks every arc it declares, and declares none it does not walk', () => {
    for (const a of ALL) {
      const j = buildJourney(a, 'x')
      const hz = j.schedule.map((d) => getFrequency(configForDay(d, j).rootId)!.hz!)
      if (j.arc === 'ascending') {
        for (let i = 1; i < hz.length; i++) expect(hz[i]).toBeGreaterThanOrEqual(hz[i - 1])
      } else if (j.arc === 'descending') {
        for (let i = 1; i < hz.length; i++) expect(hz[i]).toBeLessThanOrEqual(hz[i - 1])
      } else {
        // A steady week must actually be steady, or it should have said so.
        expect(new Set(hz).size, JSON.stringify(a)).toBe(1)
      }
    }
  })

  it('runs a club engine on every club day, and nowhere else', () => {
    for (const a of ALL) {
      const j = buildJourney(a, 'x')
      for (const day of j.schedule) {
        if (j.purpose === 'club') expect(CLUB_STYLES as string[]).toContain(day.style)
        else expect(day.style, `${a.goal}/${a.sound}`).toBeUndefined()
      }
    }
  })

  it('never asks a beat rate the band cannot play', () => {
    for (const a of ALL) {
      const j = buildJourney(a, 'x')
      for (const day of j.schedule) {
        const band = getFrequency(day.beatId!)!
        const [lo, hi] = band.range!
        expect(day.beatHz!, `${a.goal} day ${day.day}`).toBeGreaterThanOrEqual(lo)
        expect(day.beatHz!).toBeLessThanOrEqual(hi)
        // And what actually reaches the engine, which clamps again.
        expect(configForDay(day, j).beatHz).toBe(day.beatHz)
      }
    }
  })

  it('keeps a sleep week descending through its band, and travelling', () => {
    for (const a of ALL.filter((x) => x.goal === 'sleep')) {
      const j = buildJourney(a, 'x')
      const rates = j.schedule.map((d) => configForDay(d, j).beatHz)
      for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThanOrEqual(rates[i - 1])
      expect(rates[0] - rates[rates.length - 1], JSON.stringify(a)).toBeGreaterThan(0.5)
    }
  })

  it('keeps the goals that have to stay consonant off the upper harmonic series', () => {
    // Depth 0.5 is where the melody leaves familiar intervals. Falling asleep,
    // settling, concentrating and moving are all things that stop working when
    // the music does that.
    for (const a of ALL.filter((x) => ['sleep', 'calm', 'focus', 'body'].includes(x.goal))) {
      for (const day of buildJourney(a, 'x').schedule) {
        expect(day.depth!, `${a.goal} day ${day.day}`).toBeLessThan(0.5)
      }
    }
  })

  it('stays inside the ranges the engine accepts', () => {
    for (const a of ALL) {
      for (const day of buildJourney(a, 'x').schedule) {
        for (const key of ['pace', 'depth', 'density'] as const) {
          expect(day[key]!, `${a.goal} ${key}`).toBeGreaterThanOrEqual(0)
          expect(day[key]!).toBeLessThanOrEqual(1)
        }
        expect(day.durationMin).toBeGreaterThan(0)
        expect(day.note.length).toBeGreaterThan(0)
        expect(day.noteEn.length).toBeGreaterThan(0)
        expect(getFrequency(day.frequencyId)).toBeDefined()
      }
    }
  })

  it('names and describes every journey in both languages', () => {
    for (const a of ALL) {
      const j = buildJourney(a, 'x')
      for (const field of [j.title, j.titleEn, j.description, j.descriptionEn]) {
        expect(field.length, JSON.stringify(a)).toBeGreaterThan(0)
      }
      // The description states the numbers, so they have to be the real ones.
      expect(j.description).toContain(String(a.minutes))
      expect(j.descriptionEn).toContain(String(a.minutes))
    }
  })

  it('ends every week with a line that matches the direction it went', () => {
    for (const a of ALL) {
      const j = buildJourney(a, 'x')
      const last = j.schedule[j.schedule.length - 1]
      const hz = j.schedule.map((d) => getFrequency(d.frequencyId)!.hz!)
      const highest = Math.max(...hz)
      const lowest = Math.min(...hz)
      if (a.shape === 'ascending') {
        expect(hz[hz.length - 1], JSON.stringify(a)).toBe(highest)
        expect(last.noteEn).toContain('highest')
      } else if (a.shape === 'descending') {
        expect(hz[hz.length - 1], JSON.stringify(a)).toBe(lowest)
        expect(last.noteEn).toContain('lowest')
      }
    }
  })

  it('is pure — the same answers give the same week', () => {
    const a = { ...BUILDER_DEFAULTS, goal: 'spiritual' as const, days: 10 }
    expect(buildJourney(a, 'x')).toEqual(buildJourney(a, 'x'))
  })
})
