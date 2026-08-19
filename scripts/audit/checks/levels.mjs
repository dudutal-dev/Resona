import { MEASURE, openApp, wait } from '../harness.mjs'

/**
 * Every style, measured at the output, compared against each other.
 *
 * The failure this exists for has already happened once: a style shipped eleven
 * decibels quieter than the rest, and nothing said so — the app played, the
 * tests passed, and it was only audible by switching back and forth. Absolute
 * levels drift with the material, so the load-bearing assertion is the
 * **spread**: styles must stay within a range of each other, whatever the run.
 */
export const name = 'levels'
export const about = 'output level of every melody style'

const STYLES = ['ambient', 'plucked', 'techno', 'trance', 'psytrance', 'deephouse', 'organichouse', 'trippy']
/** Loud enough to be heard, quiet enough not to be hitting the limiter flat. */
const RMS_RANGE = [-34, -8]
const PEAK_RANGE = [-22, 0]
/**
 * Generative material varies by a couple of decibels between runs, and the
 * styles are genuinely different music. Twelve decibels is far wider than that
 * difference and far narrower than a style that has fallen over.
 */
const MAX_SPREAD_DB = 12

export async function run(browser) {
  const { ctx, page, errors } = await openApp(browser)
  const rows = await page.evaluate(
    async ([styles, measureSrc]) => {
      const measure = eval(`(${measureSrc})`)
      const { useSession } = await import('/src/store/sessionStore.ts')
      const out = []
      await useSession.getState().toggle()
      await new Promise((r) => setTimeout(r, 3500))
      for (const style of styles) {
        useSession.getState().setStyle(style)
        // Long enough for the fade and for a club engine to reach a bar line.
        await new Promise((r) => setTimeout(r, 4500))
        out.push({ style, ...(await measure(4)) })
      }
      await useSession.getState().toggle()
      return out
    },
    [STYLES, MEASURE],
  )
  await ctx.close()

  const failures = []
  for (const r of rows) {
    if (r.rmsDb < RMS_RANGE[0] || r.rmsDb > RMS_RANGE[1]) {
      failures.push(`${r.style}: RMS ${r.rmsDb} dBFS outside ${RMS_RANGE.join('..')}`)
    }
    if (r.peakDb < PEAK_RANGE[0] || r.peakDb > PEAK_RANGE[1]) {
      failures.push(`${r.style}: peak ${r.peakDb} dBFS outside ${PEAK_RANGE.join('..')}`)
    }
  }
  const levels = rows.map((r) => r.rmsDb)
  const spread = +(Math.max(...levels) - Math.min(...levels)).toFixed(1)
  if (spread > MAX_SPREAD_DB) {
    const loud = rows.find((r) => r.rmsDb === Math.max(...levels))
    const quiet = rows.find((r) => r.rmsDb === Math.min(...levels))
    failures.push(`spread ${spread} dB — ${loud.style} to ${quiet.style} (max ${MAX_SPREAD_DB})`)
  }
  return { rows, failures, errors, note: `spread ${spread} dB` }
}
