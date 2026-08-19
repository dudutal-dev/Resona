import { openApp } from '../harness.mjs'

/**
 * The club engines, counted at the source.
 *
 * Counting hits where they are triggered rather than looking for transients in
 * the output: a kick under a dense mix is not reliably findable in a spectrum,
 * and a check that sometimes misses is worse than none. What this defends is
 * that the styles are actually different engines and not four names for one
 * pattern — which is exactly what a shared table makes easy to break.
 */
export const name = 'groove'
export const about = 'each club engine plays its own pattern'

/** Measured from the engines as built; the ranges allow for section changes. */
const EXPECT = {
  deephouse: { kick: [95, 135], wood: [0, 0] },
  organichouse: { kick: [90, 135], wood: [60, 220] },
  trippy: { kick: [30, 75], wood: [0, 0] },
  psytrance: { kick: [120, 165], wood: [0, 0] },
}
const SAMPLE_SECONDS = 14

export async function run(browser) {
  const { ctx, page, errors } = await openApp(browser)
  const rows = await page.evaluate(
    async ([styles, seconds]) => {
      const { useSession } = await import('/src/store/sessionStore.ts')
      const Tone = window.__audio.Tone
      const hits = { kick: [], wood: [], noise: [] }

      // One MembraneSynth class covers the kick and the conga; the pitch it is
      // asked for is what separates them.
      const origMembrane = Tone.MembraneSynth.prototype.triggerAttackRelease
      Tone.MembraneSynth.prototype.triggerAttackRelease = function (...args) {
        const hz = typeof args[0] === 'number' ? args[0] : 0
        hits[hz > 200 ? 'wood' : 'kick'].push(performance.now())
        return origMembrane.apply(this, args)
      }
      const origNoise = Tone.NoiseSynth.prototype.triggerAttackRelease
      Tone.NoiseSynth.prototype.triggerAttackRelease = function (...args) {
        hits.noise.push(performance.now())
        return origNoise.apply(this, args)
      }

      const out = []
      await useSession.getState().toggle()
      await new Promise((r) => setTimeout(r, 3000))
      for (const style of styles) {
        useSession.getState().setStyle(style)
        await new Promise((r) => setTimeout(r, 4000))
        for (const k of Object.keys(hits)) hits[k].length = 0
        const t0 = performance.now()
        await new Promise((r) => setTimeout(r, seconds * 1000))
        const minutes = (performance.now() - t0) / 60000
        out.push({
          style,
          kickPerMin: Math.round(hits.kick.length / minutes),
          woodPerMin: Math.round(hits.wood.length / minutes),
          noisePerMin: Math.round(hits.noise.length / minutes),
        })
      }
      await useSession.getState().toggle()
      Tone.MembraneSynth.prototype.triggerAttackRelease = origMembrane
      Tone.NoiseSynth.prototype.triggerAttackRelease = origNoise
      return out
    },
    [Object.keys(EXPECT), SAMPLE_SECONDS],
  )
  await ctx.close()

  const failures = []
  for (const r of rows) {
    const want = EXPECT[r.style]
    const check = (label, value, [lo, hi]) => {
      if (value < lo || value > hi) failures.push(`${r.style}: ${label} ${value}/min outside ${lo}..${hi}`)
    }
    check('kick', r.kickPerMin, want.kick)
    check('wood', r.woodPerMin, want.wood)
  }
  return { rows, failures, errors, note: `${SAMPLE_SECONDS}s per style` }
}
