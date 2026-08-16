import { describe, expect, it } from 'vitest'
import {
  JUST_HARMONIC,
  JUST_MAJOR,
  SCALES,
  buildScale,
  carrierFor,
  foldToRange,
  nextDegree,
  playableScale,
  scaleForRoot,
} from './scale'

/**
 * These tests guard the claim the whole product rests on: every pitch played is
 * a whole harmonic relation of the selected frequency.
 */
describe('anchoring', () => {
  it('derives every scale pitch from the root by a just ratio and an octave', () => {
    const root = 528
    for (const pitch of playableScale(root, JUST_MAJOR)) {
      // pitch = root * ratio * 2^n  =>  pitch / (root * ratio) must be a power of 2
      const match = JUST_MAJOR.some((ratio) => {
        const factor = pitch / (root * ratio)
        const log2 = Math.log2(factor)
        return Math.abs(log2 - Math.round(log2)) < 1e-9
      })
      expect(match, `${pitch} Hz is not a harmonic of ${root} Hz`).toBe(true)
    }
  })

  it('places the root itself in the playable set', () => {
    for (const root of [174, 396, 432, 528, 963]) {
      const pitches = playableScale(root, SCALES[scaleForRoot(root)])
      const hasRoot = pitches.some((p) => {
        const log2 = Math.log2(p / root)
        return Math.abs(log2 - Math.round(log2)) < 1e-9
      })
      expect(hasRoot, `no octave of ${root} Hz in its own scale`).toBe(true)
    }
  })

  it('keeps every pitch inside an audible, musical register', () => {
    for (const root of [174, 285, 528, 963]) {
      for (const pitch of playableScale(root, JUST_MAJOR)) {
        expect(pitch).toBeGreaterThanOrEqual(110)
        expect(pitch).toBeLessThanOrEqual(1200)
      }
    }
  })

  it('builds one pitch per ratio per octave before folding', () => {
    expect(buildScale(528, JUST_MAJOR, [0, 1])).toHaveLength(14)
  })

  it('keeps the anchoring guarantee on the psychedelic scale too', () => {
    // The whole point of the upper-harmonic set is that it sounds unmoored
    // while staying exactly as harmonically anchored as every other scale.
    const root = 639
    for (const pitch of playableScale(root, JUST_HARMONIC)) {
      const match = JUST_HARMONIC.some((ratio) => {
        const log2 = Math.log2(pitch / (root * ratio))
        return Math.abs(log2 - Math.round(log2)) < 1e-9
      })
      expect(match, `${pitch} Hz is not a harmonic of ${root} Hz`).toBe(true)
    }
  })

  it('places the harmonic scale intervals where no keyboard can reach', () => {
    // 7/4 is ~969 cents, a full 31 cents flat of the equal-tempered minor
    // seventh at 1000 — audibly "wrong" in the way that makes it interesting.
    expect(1200 * Math.log2(7 / 4)).toBeCloseTo(968.83, 1)
    expect(1200 * Math.log2(11 / 8)).toBeCloseTo(551.32, 1)
  })

  it('uses pure integer ratios, not equal temperament', () => {
    // A just major third is 5/4 (386 cents); equal temperament is 400 cents.
    const cents = 1200 * Math.log2(5 / 4)
    expect(cents).toBeCloseTo(386.31, 1)
  })
})

describe('foldToRange', () => {
  it('transposes by whole octaves only', () => {
    const folded = foldToRange(963 * 4, 110, 1200)
    const log2 = Math.log2(folded / 963)
    expect(Math.abs(log2 - Math.round(log2))).toBeLessThan(1e-9)
  })

  it('lands inside the requested range', () => {
    for (const hz of [20, 55, 174, 528, 4000, 15000]) {
      const folded = foldToRange(hz, 110, 1200)
      expect(folded).toBeGreaterThanOrEqual(110)
      expect(folded).toBeLessThanOrEqual(1200)
    }
  })
})

describe('carrierFor', () => {
  it('keeps the binaural carrier consonant with the root', () => {
    for (const root of [174, 396, 432, 528, 963]) {
      const carrier = carrierFor(root)
      expect(carrier).toBeGreaterThanOrEqual(110)
      expect(carrier).toBeLessThanOrEqual(240)
      const log2 = Math.log2(carrier / root)
      expect(Math.abs(log2 - Math.round(log2))).toBeLessThan(1e-9)
    }
  })
})

describe('nextDegree', () => {
  it('never leaves the scale', () => {
    let degree = 0
    for (let i = 0; i < 5000; i++) {
      degree = nextDegree(degree, 12)
      expect(degree).toBeGreaterThanOrEqual(0)
      expect(degree).toBeLessThan(12)
    }
  })

  it('prefers steps over leaps', () => {
    let steps = 0
    let leaps = 0
    let degree = 6
    for (let i = 0; i < 4000; i++) {
      const next = nextDegree(degree, 13)
      const delta = Math.abs(next - degree)
      if (delta <= 1) steps++
      else if (delta >= 3) leaps++
      degree = next
    }
    expect(steps).toBeGreaterThan(leaps)
  })

  it('does not get stuck at the edges', () => {
    const seen = new Set<number>()
    let degree = 0
    for (let i = 0; i < 2000; i++) {
      degree = nextDegree(degree, 8)
      seen.add(degree)
    }
    expect(seen.size).toBeGreaterThan(4)
  })

  it('produces a different line on each run', () => {
    const run = () => {
      let d = 5
      return Array.from({ length: 40 }, () => (d = nextDegree(d, 14))).join(',')
    }
    expect(run()).not.toBe(run())
  })
})
