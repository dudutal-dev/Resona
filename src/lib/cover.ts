import { getFrequency } from './catalog'
import { THEME_HUE, themeOf } from './themes'
import type { Frequency, Journey } from './types'

/**
 * Cover art, drawn from the thing it is a cover for.
 *
 * The first version of the release layout borrowed the eleven figure
 * renders — photographs of people — and hashed an id to pick one. That is
 * wrong twice over: the same picture turns up under four unrelated
 * frequencies, and none of the pictures has anything to do with the number
 * printed under it. A cover is supposed to be an identifier.
 *
 * So these are generated instead, and generated *from the subject*. A
 * frequency's cover is its own standing wave: a rosette whose petal count and
 * ring spacing come out of its pitch, tinted with the hue that same pitch
 * gives the interface, with the number itself set on the plate. A journey's
 * cover is its arc — one node per day, placed at the height of the root that
 * day plays, joined in order, so the shape of the picture is the shape of the
 * week.
 *
 * They are SVG data URIs rather than files: about a kilobyte each, sharp at
 * any size, nothing to download, and no build step between adding a frequency
 * and it having art. Memoised because `<img src>` changing identity between
 * renders would make the browser re-decode on every keystroke.
 */

const cache = new Map<string, string>()

function memo(key: string, build: () => string): string {
  const hit = cache.get(key)
  if (hit) return hit
  const made = `data:image/svg+xml,${encodeURIComponent(build())}`
  cache.set(key, made)
  return made
}

const SIZE = 400

/** Deterministic small integer from a number, spread across [lo, hi]. */
function spread(seed: number, lo: number, hi: number): number {
  // The fractional part matters: 396, 417 and 432 are close enough that
  // dividing alone would give all three the same figure.
  const mixed = Math.abs(Math.sin(seed * 0.0173) * 10_000)
  return lo + Math.floor(mixed % (hi - lo + 1))
}

/**
 * A rhodonea — r = cos(kθ) — sampled into a closed path.
 *
 * This is the shape a pure tone makes against itself, and it is the one figure
 * that stays legible at forty pixels and rewards a look at two hundred and
 * forty: `k` changes the petal count, so two frequencies are told apart by
 * counting rather than by squinting at a texture.
 */
function rose(cx: number, cy: number, radius: number, k: number, inner: number): string {
  const steps = 720
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2
    const r = radius * (inner + (1 - inner) * Math.abs(Math.cos(k * th)))
    const x = cx + Math.cos(th) * r
    const y = cy + Math.sin(th) * r
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }
  return `${d}Z`
}

function plate(hue: number, seed: number, caption: string): string {
  // Three independent parameters, because one is not enough: with only a petal
  // count, 174 and 285 came out as the same daisy in different colours.
  const petals = spread(seed, 2, 11)
  const inner = 0.16 + spread(seed + 31, 0, 8) * 0.05
  // The inner figure runs at a different count, so the two interfere instead of
  // one being a shadow of the other. That interference is what a plate actually
  // does, and it is what makes forty of these tell apart.
  const counter = petals + spread(seed + 47, 1, 4)
  const rings = spread(seed + 7, 5, 9)
  const twist = spread(seed + 13, -30, 30)
  const cx = SIZE / 2
  const cy = SIZE / 2 - 22

  const ringMarks = Array.from({ length: rings }, (_, i) => {
    const r = 30 + (i / (rings - 1)) * 128
    const o = (0.4 - (i / rings) * 0.25).toFixed(3)
    return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="hsl(${hue} 90% 68%)" stroke-opacity="${o}" stroke-width="1.1"/>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
<defs>
<radialGradient id="g" cx="50%" cy="40%" r="76%">
<stop offset="0%" stop-color="hsl(${hue} 74% 19%)"/>
<stop offset="52%" stop-color="hsl(${hue} 80% 8%)"/>
<stop offset="100%" stop-color="hsl(${(hue + 26) % 360} 86% 3%)"/>
</radialGradient>
<radialGradient id="c" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="hsl(${hue} 100% 90%)" stop-opacity="0.95"/>
<stop offset="42%" stop-color="hsl(${hue} 100% 66%)" stop-opacity="0.42"/>
<stop offset="100%" stop-color="hsl(${hue} 100% 60%)" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
${ringMarks}
<g transform="rotate(${twist} ${cx} ${cy})">
<path d="${rose(cx, cy, 150, petals, inner)}" fill="hsl(${(hue + 38) % 360} 95% 62%)" fill-opacity="0.1" stroke="hsl(${(hue + 38) % 360} 96% 74%)" stroke-opacity="0.85" stroke-width="1.6"/>
<path d="${rose(cx, cy, 96, counter, Math.min(0.62, inner + 0.2))}" fill="none" stroke="hsl(${hue} 100% 82%)" stroke-opacity="0.55" stroke-width="1.1"/>
</g>
<circle cx="${cx}" cy="${cy}" r="56" fill="url(#c)"/>
<text x="${SIZE / 2}" y="${SIZE - 40}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="29" font-weight="600" letter-spacing="3" fill="#fff" fill-opacity="0.9">${caption}</text>
</svg>`
}

/** The label printed on the plate — the number is the name of the thing. */
function captionFor(freq: Frequency): string {
  if (freq.hz !== undefined) return `${freq.hz} Hz`
  if (freq.range) return `${freq.range[0]}–${freq.range[1]} Hz`
  return 'Hz'
}

export function frequencyCover(freq: Frequency): string {
  return memo(`f:${freq.id}`, () =>
    plate(freq.hue, Math.round((freq.hz ?? freq.range?.[0] ?? 100) * 10), captionFor(freq)),
  )
}

/**
 * The journey's own arc, as rings.
 *
 * The first version drew it as a line with a node per day, which was accurate
 * and read as a chart — the one cover in the set that looked like data rather
 * than like art. Same information, different figure: one ring per day, each
 * smaller than the one before it so the eye falls inward along the order the
 * nights are listed in, and each ring's centre riding the root that day plays.
 * An ascending week spirals up out of the frame, a descending one settles down
 * into it, and a journey that holds a single root is perfectly concentric,
 * which is exactly what it is.
 */
export function journeyCover(journey: Journey): string {
  return memo(`j:${journey.id}`, () => {
    const hue = THEME_HUE[themeOf(journey)]
    const roots = journey.schedule.map((d) => {
      const f = getFrequency(d.frequencyId)
      // Two journeys can climb the same ladder — the seven chakras are the
      // seven chakras — so the roots alone cannot tell them apart. What differs
      // is how the nights *sound*, and that is what the ring is drawn from:
      // density gives it weight, and pace breaks it into ticks. A held drone is
      // a solid hairline; a flowing practice is a heavy dashed circle.
      return {
        hz: f?.hz ?? f?.range?.[0] ?? 200,
        hue: f?.hue ?? hue,
        density: d.density ?? 0.5,
        pace: d.pace ?? 0.3,
      }
    })
    const values = roots.map((r) => r.hz)
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    // A journey that holds one root has no span. Every ring then lands on the
    // centre line, which is the honest picture of a week that does not travel.
    const span = hi - lo || 1
    const flat = hi === lo
    const n = roots.length

    const cx = SIZE / 2
    const mid = SIZE / 2 - 26
    const rings = roots.map((r, i) => {
      // Day one is the widest and every day after it is smaller, so the eye
      // falls inward along the order the nights are listed in.
      const radius = 150 * (1 - 0.87 * (n === 1 ? 0 : i / (n - 1)))
      const norm = flat ? 0.5 : (r.hz - lo) / span
      // ...and the ring's centre rides the root it plays, so an ascending week
      // spirals up out of the frame and a descending one settles down into it.
      const cy = mid - (norm - 0.5) * 84
      // A dash long enough to read as a line below walking pace, and short
      // enough to read as a run of events above it.
      const dash = r.pace < 0.18 ? null : Math.max(4, 34 - r.pace * 40)
      return {
        radius,
        cy,
        hue: r.hue,
        norm,
        weight: 0.6 + r.density * 4.4,
        dash,
      }
    })

    const from = roots[0].hue
    const to = roots[n - 1].hue

    const halos = rings
      .map(
        (r, i) =>
          `<circle cx="${cx}" cy="${r.cy.toFixed(1)}" r="${r.radius.toFixed(1)}" fill="none" stroke="hsl(${r.hue} 100% 70%)" stroke-opacity="0.16" stroke-width="${(9 - i * 0.4).toFixed(1)}"/>`,
      )
      .join('')

    const lines = rings
      .map(
        (r) =>
          `<circle cx="${cx}" cy="${r.cy.toFixed(1)}" r="${r.radius.toFixed(1)}" fill="hsl(${r.hue} 88% 58%)" fill-opacity="0.05" stroke="hsl(${r.hue} 96% 74%)" stroke-opacity="0.9" stroke-width="${r.weight.toFixed(2)}"${r.dash ? ` stroke-dasharray="${r.dash.toFixed(1)} ${(r.dash * 0.6).toFixed(1)}" stroke-linecap="round"` : ''}/>`,
      )
      .join('')

    const last = rings[n - 1]

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0%" stop-color="hsl(${hue} 76% 21%)"/>
<stop offset="42%" stop-color="hsl(${from} 74% 11%)"/>
<stop offset="100%" stop-color="hsl(${to} 86% 4%)"/>
</linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="hsl(${to} 86% 4%)" stop-opacity="0"/>
<stop offset="100%" stop-color="hsl(${to} 86% 4%)" stop-opacity="0.88"/>
</linearGradient>
<radialGradient id="c" cx="50%" cy="50%" r="50%">
<stop offset="0%" stop-color="hsl(${to} 100% 90%)" stop-opacity="0.9"/>
<stop offset="45%" stop-color="hsl(${to} 100% 68%)" stop-opacity="0.4"/>
<stop offset="100%" stop-color="hsl(${to} 100% 62%)" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
${halos}
${lines}
<circle cx="${cx}" cy="${last.cy.toFixed(1)}" r="${Math.max(30, last.radius * 1.9).toFixed(1)}" fill="url(#c)"/>
<rect x="0" y="${SIZE - 96}" width="${SIZE}" height="96" fill="url(#s)"/>
<text x="${SIZE / 2}" y="${SIZE - 34}" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" font-size="25" font-weight="600" letter-spacing="2" fill="#fff" fill-opacity="0.88">${values[0]} \u2192 ${values[values.length - 1]}</text>
</svg>`
  })
}

/**
 * Anything else that needs a square — a saved preset, mostly. It is the root
 * frequency's plate, because that is what the preset plays.
 */
export function coverForRoot(rootId: string): string {
  const freq = getFrequency(rootId)
  return freq ? frequencyCover(freq) : memo('fallback', () => plate(265, 5280, 'Resona'))
}
