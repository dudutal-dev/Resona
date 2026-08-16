/**
 * The picture the system hands to whatever is showing "now playing" — the lock
 * screen, a car display, or a speaker the session is being cast to.
 *
 * It is drawn here at runtime rather than shipped as a file, for two reasons.
 * The obvious one is that the single-file build has no `icons/` directory to
 * point at, so a static path resolves to nothing there. The better one is that
 * a fixed app icon says the same thing on every session; a cover drawn per
 * session can carry the frequency, the journey and the day, in the colour the
 * app is currently wearing — which is the whole point of looking at the player.
 *
 * The scene is the same one the splash screen animates: harmonic rings with
 * satellites sitting on them, around a glowing centre. Satellite placement is
 * seeded by the session, so a given frequency always draws its own constellation
 * instead of a new arrangement every time the metadata is republished.
 */

export type CoverSpec = {
  /** Base hue, normally the current frequency's. */
  hue: number
  /** Second hue for the outer rings — a journey's theme colour, when there is one. */
  accentHue?: number
  /** The big number in the middle, usually the root in Hz. */
  headline: string
  /** Small label under the headline. */
  unit?: string
  /** One line beneath the rings — journey title, or the frequency's name. */
  caption?: string
  /** Smaller line under the caption — the day within a journey. */
  footnote?: string
}

/** Two sizes so a UA picking by size still gets something we drew. */
const SIZES = [512, 256]
const MAX_CACHE = 10

const cache = new Map<string, MediaImage[]>()

const RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8]

function keyOf(spec: CoverSpec): string {
  return [
    Math.round(spec.hue),
    Math.round(spec.accentHue ?? spec.hue),
    spec.headline,
    spec.unit ?? '',
    spec.caption ?? '',
    spec.footnote ?? '',
  ].join('|')
}

function hashOf(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small deterministic generator, so the same session redraws the same cover. */
function rng(seed: number) {
  let s = seed || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

const hsla = (h: number, s: number, l: number, a: number) =>
  `hsla(${((h % 360) + 360) % 360}, ${s}%, ${l}%, ${a})`

/**
 * Draws `text` centred at `y`, shrinking it until it fits the cover's width and
 * clipping with an ellipsis only if even the smallest size overflows. Journey
 * titles vary a lot in length and a cover that runs off its own edge looks
 * broken on a car display.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  y: number,
  em: number,
  weight: number,
  color: string,
) {
  const maxWidth = size * 0.84
  let px = size * em
  const floor = px * 0.68
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = color
  let shown = text
  ctx.font = `${weight} ${px}px ${FONT}`
  while (ctx.measureText(shown).width > maxWidth && px > floor) {
    px -= size * 0.004
    ctx.font = `${weight} ${px}px ${FONT}`
  }
  while (shown.length > 1 && ctx.measureText(shown).width > maxWidth) {
    shown = shown.slice(0, -1)
  }
  if (shown !== text) shown = `${shown.trim()}…`
  ctx.fillText(shown, size / 2, y)
}

function paint(canvas: HTMLCanvasElement, size: number, spec: CoverSpec) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = size
  canvas.height = size

  const h = spec.hue
  const a = spec.accentHue ?? spec.hue
  const cx = size / 2
  // The rings sit above centre; the two text lines take the bottom fifth.
  const cy = size * 0.44
  const random = rng(hashOf(keyOf(spec)))

  // Ground: dark enough that white text reads on any display, tinted by both
  // hues so a journey's colour is present even before the rings are drawn.
  const ground = ctx.createLinearGradient(0, 0, size, size)
  ground.addColorStop(0, hsla(h, 46, 9, 1))
  ground.addColorStop(0.5, hsla((h + a) / 2, 40, 5, 1))
  ground.addColorStop(1, hsla(a, 48, 8, 1))
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, size, size)

  // Bloom behind the rings.
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.52)
  bloom.addColorStop(0, hsla(h, 96, 62, 0.42))
  bloom.addColorStop(0.42, hsla(h, 96, 58, 0.13))
  bloom.addColorStop(1, hsla(h, 96, 50, 0))
  ctx.fillStyle = bloom
  ctx.fillRect(0, 0, size, size)

  // Harmonic rings, alternating between the two hues.
  const radii = [0.155, 0.215, 0.275, 0.335]
  radii.forEach((r, i) => {
    ctx.beginPath()
    ctx.arc(cx, cy, size * r, 0, Math.PI * 2)
    ctx.lineWidth = size * (i === 0 ? 0.008 : 0.005)
    ctx.strokeStyle = hsla(i % 2 ? a : h, 95, 74, 0.5 - i * 0.09)
    ctx.stroke()
  })

  // Satellites: one per harmonic ratio, parked at a seeded angle.
  ctx.shadowBlur = size * 0.035
  RATIOS.forEach((ratio, i) => {
    const r = size * radii[i % radii.length]
    const angle = random() * Math.PI * 2
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    const hue = i % 2 ? a : h
    ctx.shadowColor = hsla(hue, 100, 68, 0.9)
    // Simpler ratios sit lower and brighter, the way they do in the spectrum.
    ctx.fillStyle = hsla(hue, 100, 86 - ratio * 6, 0.95)
    ctx.beginPath()
    ctx.arc(x, y, size * (0.0125 - i * 0.0008), 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.shadowBlur = 0

  // Core, sitting behind the number so the digits read as lit from within.
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.135)
  core.addColorStop(0, hsla(h, 100, 92, 0.5))
  core.addColorStop(0.55, hsla(h, 100, 66, 0.22))
  core.addColorStop(1, hsla(h, 100, 60, 0))
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.135, 0, Math.PI * 2)
  ctx.fill()

  // The wordmark, quiet — the album field already says Resona, this is for the
  // displays that show only the picture.
  ctx.direction = 'ltr'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${size * 0.042}px ${FONT}`
  ctx.fillStyle = hsla(h, 60, 88, 0.5)
  ctx.fillText('RESONA', cx, size * 0.085)

  // Headline: the number, glowing.
  ctx.shadowColor = hsla(h, 100, 66, 0.85)
  ctx.shadowBlur = size * 0.07
  const headY = spec.unit ? cy - size * 0.022 : cy
  fitText(ctx, spec.headline, size, headY, 0.175, 700, 'rgba(255,255,255,0.98)')
  ctx.shadowBlur = 0

  if (spec.unit) {
    ctx.direction = 'ltr'
    ctx.font = `600 ${size * 0.048}px ${FONT}`
    ctx.fillStyle = hsla(h, 90, 84, 0.8)
    ctx.textAlign = 'center'
    ctx.fillText(spec.unit, cx, cy + size * 0.082)
  }

  // Hebrew below, so the caption is laid out right-to-left.
  ctx.direction = 'rtl'
  if (spec.caption) {
    fitText(ctx, spec.caption, size, size * 0.845, 0.072, 700, 'rgba(255,255,255,0.94)')
  }
  if (spec.footnote) {
    fitText(ctx, spec.footnote, size, size * 0.925, 0.05, 500, hsla(a, 70, 86, 0.72))
  }
}

/**
 * Renders the cover and returns it as Media Session artwork.
 *
 * Data URLs rather than object URLs on purpose: the metadata outlives any one
 * call, and an object URL revoked at the wrong moment leaves the player showing
 * a blank square. Returns an empty list where there is no canvas to draw on
 * (tests, SSR), which the caller treats as "no artwork" rather than an error.
 */
export function coverArtwork(spec: CoverSpec): MediaImage[] {
  const key = keyOf(spec)
  const hit = cache.get(key)
  if (hit) return hit
  if (typeof document === 'undefined') return []

  let images: MediaImage[]
  try {
    const canvas = document.createElement('canvas')
    images = SIZES.map((size) => {
      paint(canvas, size, spec)
      // JPEG, not PNG: the cover is all smooth gradients, which PNG stores
      // badly — half a megabyte per size, carried in a string that lives as
      // long as the metadata does. At this quality it is under 30KB and the
      // difference is invisible on a player.
      return {
        src: canvas.toDataURL('image/jpeg', 0.88),
        sizes: `${size}x${size}`,
        type: 'image/jpeg',
      }
    })
  } catch {
    return []
  }

  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string)
  cache.set(key, images)
  return images
}
