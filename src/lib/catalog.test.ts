import { describe, expect, it } from 'vitest'
import {
  BAND_MUSICAL_ROOT,
  BEAT_FREQUENCIES,
  FREQUENCIES,
  JOURNEYS,
  PURPOSE_LABEL,
  ROOT_FREQUENCIES,
  TRUST_NOTICE,
  defaultBeatHz,
  getFrequency,
} from './catalog'
import { configForDay } from './journeyConfig'
import { THEME_OF, journeysByTheme } from './themes'
import { ROOT_GROUPS } from './catalog'
import { DEFAULT_CONFIG } from '../store/sessionStore'
import { resolveTimerMinutes } from '../audio/SessionPlayer'

describe('frequency catalog', () => {
  it('carries the nine solfeggio tones, five bands and the 432 tuning', () => {
    expect(FREQUENCIES.filter((f) => f.type === 'solfeggio')).toHaveLength(9)
    expect(FREQUENCIES.filter((f) => f.type === 'binaural')).toHaveLength(5)
    expect(FREQUENCIES.filter((f) => f.type === 'tuning')).toHaveLength(1)
    expect(ROOT_FREQUENCIES).toHaveLength(10)
  })

  it('gives every entry an id, a label and a transparency notice', () => {
    const ids = new Set<string>()
    for (const f of FREQUENCIES) {
      expect(f.id).toBeTruthy()
      expect(ids.has(f.id), `duplicate id ${f.id}`).toBe(false)
      ids.add(f.id)
      expect(f.label.length).toBeGreaterThan(0)
      expect(f.info.length).toBeGreaterThan(0)
      expect(TRUST_NOTICE[f.trust]).toBeTruthy()
    }
  })

  it('marks solfeggio and tuning entries as tradition-based, not research-backed', () => {
    for (const f of FREQUENCIES) {
      if (f.type === 'binaural') expect(f.trust).toBe('research_backed_partial')
      else expect(f.trust).toBe('traditional')
    }
  })

  it('defaults each band to the middle of its range', () => {
    for (const f of BEAT_FREQUENCIES) {
      const hz = defaultBeatHz(f)
      expect(hz).toBeGreaterThanOrEqual(f.range[0])
      expect(hz).toBeLessThanOrEqual(f.range[1])
    }
  })
})

describe('journeys', () => {
  it('gives every journey a schedule matching its declared length', () => {
    // Deliberately not a fixed count — journeys are content and are expected to
    // grow; what must hold is that each one is internally consistent.
    expect(JOURNEYS.length).toBeGreaterThanOrEqual(4)
    for (const j of JOURNEYS) {
      expect(j.schedule, j.id).toHaveLength(j.days)
      expect(j.schedule.map((d) => d.day), j.id).toEqual(
        Array.from({ length: j.days }, (_, i) => i + 1),
      )
    }
  })

  it('gives every journey a unique id, a title and a description', () => {
    const ids = new Set<string>()
    for (const j of JOURNEYS) {
      expect(ids.has(j.id), `duplicate journey id ${j.id}`).toBe(false)
      ids.add(j.id)
      expect(j.title.length, j.id).toBeGreaterThan(0)
      expect(j.description.length, j.id).toBeGreaterThan(0)
    }
  })

  it('honours every declared arc', () => {
    const withArc = JOURNEYS.filter((j) => j.arc)
    expect(withArc.length, 'no journey declares an arc').toBeGreaterThan(0)
    for (const j of withArc) {
      // A band day has no pitch of its own, so compare the root the day
      // actually plays — the same value configForDay resolves.
      const roots = j.schedule.map((d) => getFrequency(configForDay(d, j).rootId)!.hz!)
      for (let i = 1; i < roots.length; i++) {
        const [prev, cur] = [roots[i - 1], roots[i]]
        const msg = `${j.id} (${j.arc}) goes ${prev} -> ${cur} on day ${i + 1}`
        if (j.arc === 'ascending') expect(cur, msg).toBeGreaterThanOrEqual(prev)
        else expect(cur, msg).toBeLessThanOrEqual(prev)
      }
    }
  })

  it('covers both arc directions', () => {
    const arcs = new Set(JOURNEYS.map((j) => j.arc).filter(Boolean))
    expect(arcs).toContain('ascending')
    expect(arcs).toContain('descending')
  })

  it('keeps the rhythmic journeys above the pace threshold that starts the pulse', () => {
    for (const j of JOURNEYS.filter((x) => x.purpose === 'rhythm')) {
      for (const day of j.schedule) {
        expect(day.pace, `${j.id} day ${day.day}`).toBeGreaterThanOrEqual(0.45)
        expect(day.pace).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps the work journeys unobtrusive enough to think over', () => {
    const work = JOURNEYS.filter((j) => j.purpose === 'work')
    expect(work.length).toBeGreaterThan(0)
    for (const j of work) {
      for (const day of j.schedule) {
        const where = `${j.id} day ${day.day}`
        // Sparse, still and undistorted: anything denser, faster or deeper
        // stops being background and starts competing for attention.
        expect(day.density, `${where} density`).toBeLessThanOrEqual(0.4)
        expect(day.pace, `${where} pace`).toBeLessThanOrEqual(0.3)
        expect(day.depth, `${where} depth`).toBe(0)
      }
      // A work session has to outlast a real block of work.
      const longest = Math.max(...j.schedule.map((d) => d.durationMin))
      expect(longest, `${j.id} longest session`).toBeGreaterThanOrEqual(60)
    }
  })

  it('labels and colours every purpose in use', () => {
    for (const j of JOURNEYS) {
      expect(PURPOSE_LABEL[j.purpose], `no label for purpose ${j.purpose}`).toBeTruthy()
    }
  })

  it('references only frequencies that exist', () => {
    for (const j of JOURNEYS) {
      for (const day of j.schedule) {
        expect(getFrequency(day.frequencyId), `${j.id} day ${day.day}`).toBeDefined()
        expect(day.durationMin).toBeGreaterThan(0)
        expect(day.note.length).toBeGreaterThan(0)
      }
    }
  })

  it('pairs every brainwave band with a musical root', () => {
    for (const band of BEAT_FREQUENCIES) {
      const rootId = BAND_MUSICAL_ROOT[band.id]
      expect(rootId, `no musical root for ${band.id}`).toBeDefined()
      expect(getFrequency(rootId)?.hz).toBeTypeOf('number')
    }
  })
})

describe('configForDay', () => {
  it('keeps a solfeggio day as the root and adds a supporting band under it', () => {
    const day = { day: 1, frequencyId: 'sol-396', durationMin: 30, note: '' }
    const config = configForDay(day, { purpose: 'sleep' })
    expect(config.rootId).toBe('sol-396')
    // A sleep journey leans on delta, and the support stays quieter than the
    // prescribed tone so the day's own frequency remains the subject.
    expect(config.beatId).toBe('bb-delta')
    expect(config.levels.beat).toBeLessThan(config.levels.melody)
  })

  it('lets a day name its own supporting band', () => {
    const day = { day: 1, frequencyId: 'sol-396', durationMin: 30, note: '', beatId: 'bb-gamma' }
    expect(configForDay(day, { purpose: 'sleep' }).beatId).toBe('bb-gamma')
  })

  it('gives every journey day a brainwave layer', () => {
    for (const j of JOURNEYS) {
      for (const day of j.schedule) {
        const config = configForDay(day, j)
        expect(config.beatId, `${j.id} day ${day.day}`).toBeTruthy()
        expect(getFrequency(config.beatId!)?.range, `${j.id} day ${day.day}`).toBeDefined()
        // The beat rate must sit inside the band it came from.
        const range = getFrequency(config.beatId!)!.range!
        expect(config.beatHz).toBeGreaterThanOrEqual(range[0])
        expect(config.beatHz).toBeLessThanOrEqual(range[1])
      }
    }
  })

  it('turns a band day into a beat plus a pitched root', () => {
    const day = { day: 4, frequencyId: 'bb-delta', durationMin: 60, note: '' }
    const config = configForDay(day, { purpose: 'sleep' })
    expect(config.beatId).toBe('bb-delta')
    expect(getFrequency(config.rootId)?.hz).toBeTypeOf('number')
    // The beat rate must fall inside the band it came from.
    const range = getFrequency('bb-delta')!.range!
    expect(config.beatHz).toBeGreaterThanOrEqual(range[0])
    expect(config.beatHz).toBeLessThanOrEqual(range[1])
  })

  it('honours the prescribed duration exactly, without rounding to a preset', () => {
    for (const j of JOURNEYS) {
      for (const day of j.schedule) {
        const config = configForDay(day, j)
        expect(resolveTimerMinutes(config)).toBe(day.durationMin)
      }
    }
  })
})

describe('journey day isolation', () => {
  it('does not let one day\'s character leak into the next', () => {
    const psychedelic = { day: 1, frequencyId: 'sol-639', durationMin: 30, note: '', depth: 1, pace: 0.9 }
    const plain = { day: 1, frequencyId: 'sol-528', durationMin: 20, note: '' }

    // Play a deep, fast day, then start a day that specifies neither.
    const after = configForDay(psychedelic, { purpose: 'psychedelic' })
    const next = configForDay(plain, { purpose: 'spiritual' }, after)

    expect(next.depth, 'depth leaked from the previous day').toBe(DEFAULT_CONFIG.depth)
    expect(next.pace, 'pace leaked from the previous day').toBe(DEFAULT_CONFIG.pace)
  })
})


describe('grouping', () => {
  it('shelves every journey exactly once', () => {
    const grouped = journeysByTheme().flatMap((g) => g.journeys)
    // Grouping is presentation, and a presentation bug that hides content is
    // invisible until someone notices a journey they cannot find.
    expect(grouped).toHaveLength(JOURNEYS.length)
    expect(new Set(grouped.map((j) => j.id)).size).toBe(JOURNEYS.length)
    for (const j of JOURNEYS) expect(THEME_OF[j.purpose], `${j.id} has no theme`).toBeTruthy()
  })

  it('lists every root frequency exactly once across the picker groups', () => {
    const listed = ROOT_GROUPS.flatMap((g) => g.items)
    expect(listed.map((f) => f.id).sort()).toEqual(ROOT_FREQUENCIES.map((f) => f.id).sort())
  })

  it('orders the solfeggio group by pitch', () => {
    const hz = ROOT_GROUPS.find((g) => g.id === 'solfeggio')!.items.map((f) => f.hz!)
    expect(hz).toEqual([...hz].sort((a, b) => a - b))
  })
})
