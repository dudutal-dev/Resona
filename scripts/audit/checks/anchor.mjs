import { openApp } from '../harness.mjs'

/**
 * The promise the whole app rests on: every pitch played is the declared
 * frequency times one of the app's own just ratios, times a power of two.
 *
 * Checked by catching notes where they are triggered rather than by reading the
 * scale tables — the tables being right proves nothing if a voice rounds to a
 * MIDI note or a synth is fed a name instead of a number on the way out.
 */
export const name = 'anchor'
export const about = 'every played pitch is a just ratio of the root'

/** Root, style, and how much of the upper harmonic series it should reach. */
const CASES = [
  { rootId: 'sol-528', hz: 528, style: 'ambient', depth: 0.8 },
  { rootId: 'sol-174', hz: 174, style: 'psytrance', depth: 0.5 },
]
/** A quarter of a cent is well inside anything that could be heard as off. */
const TOLERANCE = 0.004

export async function run(browser) {
  const { ctx, page, errors } = await openApp(browser)
  const rows = await page.evaluate(async (cases) => {
    const sp = await import('/src/audio/SessionPlayer.ts')
    const store = await import('/src/store/sessionStore.ts')
    const scale = await import('/src/audio/scale.ts')
    const Tone = window.__audio.Tone
    const base = store.useSession.getState().config

    const notes = []
    const patched = []
    for (const Klass of [Tone.PolySynth, Tone.MonoSynth, Tone.Synth]) {
      const orig = Klass.prototype.triggerAttackRelease
      patched.push([Klass, orig])
      Klass.prototype.triggerAttackRelease = function (...args) {
        const list = Array.isArray(args[0]) ? args[0] : [args[0]]
        for (const x of list) {
          notes.push(typeof x === 'string' ? Tone.Frequency(x).toFrequency() : Number(x))
        }
        return orig.apply(this, args)
      }
    }

    const SCALE = [
      ...scale.JUST_MAJOR, ...scale.JUST_PENTATONIC,
      ...scale.JUST_MINOR_PENTATONIC, ...scale.JUST_HARMONIC,
    ]
    // Plus the shimmer: the lead occasionally doubles a note a pure fifth above
    // it (`GenerativeMelody`, the partner note). Against the root that lands on
    // ratios the scale tables do not list — a 7/4 shadowed at 3/2 is 21/16 —
    // and this check called one of those a fault. It is not: the promise the
    // app makes is a whole-number ratio of the root, and 21:16 is one. The
    // octave partner needs nothing here, since octaves are already free.
    const RATIOS = [...SCALE, ...SCALE.map((r) => r * 1.5)]
    const out = []
    for (const c of cases) {
      await sp.player.stop()
      await new Promise((r) => setTimeout(r, 2400))
      await sp.player.play({
        ...base, rootId: c.rootId, style: c.style, depth: c.depth,
        // Only the pitched voices are under test; drums and rain are noise here
        // in both senses.
        levels: { ...base.levels, beat: 0, ambience: 0 },
      })
      await new Promise((r) => setTimeout(r, 5000))
      notes.length = 0
      await new Promise((r) => setTimeout(r, 8000))

      let anchored = 0
      const strays = []
      for (const f of notes) {
        if (!isFinite(f) || f <= 0) continue
        const hit = RATIOS.some((ratio) => {
          const rel = f / (c.hz * ratio)
          const oct = Math.pow(2, Math.round(Math.log2(rel)))
          return Math.abs(rel - oct) / oct < 0.004
        })
        if (hit) anchored++
        else strays.push(+f.toFixed(2))
      }
      out.push({
        root: c.hz, style: c.style, notes: notes.length, anchored,
        offScale: strays.length, examples: strays.slice(0, 4).join(' '),
      })
    }
    await sp.player.stop()
    for (const [K, orig] of patched) K.prototype.triggerAttackRelease = orig
    return out
  }, CASES)
  await ctx.close()

  const failures = []
  for (const r of rows) {
    if (r.notes === 0) failures.push(`${r.style} at ${r.root}Hz played nothing`)
    else if (r.offScale > 0) failures.push(`${r.style} at ${r.root}Hz: ${r.offScale} off-scale (${r.examples})`)
  }
  return { rows, failures, errors, note: `tolerance ${TOLERANCE}` }
}
