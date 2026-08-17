import { useEffect, useRef } from 'react'
import figureData from '../data/figure.json'
import { engine } from '../audio/ToneEngine'
import { BAND_COUNT, MAX_RATIO, RATIOS, readBands } from '../audio/harmonics'
import { getFrequency } from '../lib/catalog'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'

/**
 * The figure, as a living field of light.
 *
 * `scripts/extract-figure.mjs` reduces the source artwork to thirty-seven
 * thousand points and labels each one; this draws every one of them itself,
 * every frame. That is the whole reason for the detour: a picture can be lit and
 * faded, but only a point cloud can be *moved*, and moving is what makes it
 * belong to the sound.
 *
 * The labels matter as much as the points. The artwork draws the chest as about
 * twenty-five concentric rings, and at their own size they fill the torso with a
 * disc so bright the person cannot be seen — which is exactly how this first
 * looked. They are not deleted, because there is no body underneath them, and
 * they are not left alone either. They are drawn compressed toward the centre,
 * so the mass that was hiding the figure becomes a core that sits inside it, and
 * the ring the limbs attach to is held at full size so the body stays joined.
 *
 * That compression is also the best thing in the picture, because it is not
 * fixed. Every ring answers to one interval of the just scale, so as the music
 * plays the core opens ring by ring, and on a loud chord it swells back out to
 * the boundary it came from — the figure inhales.
 *
 * Four things move the points, in rising order of how much they matter:
 *
 *   1. A slow per-point drift, so nothing is ever perfectly still.
 *   2. A global breath on the overall level.
 *   3. The waveform, sampled by the angle each point sits at, pushing it along
 *      its own radius. Gently on the body, where the shape has to stay
 *      readable; hard on the core, where it reads as energy.
 *   4. Its shell — its distance from the centre, mapped to one interval.
 *
 * A transient in a band fires an impulse into its shell, which travels outward
 * and settles, so the figure visibly answers a note being struck.
 *
 * The glow is a second pass at a third of the resolution, upscaled: browsers
 * interpolate that for free, which is a real bloom for the cost of one drawImage
 * rather than thirty-seven thousand shadowed fills. It is deliberately weak —
 * bloom is what turned the first version into a smear, and the sharpness of the
 * points is the point.
 */

type Props = {
  playing: boolean
  /** Drives point size — a television is looked at from much further away. */
  scale?: number
  className?: string
}

/** Kinds, as `extract-figure.mjs` writes them: 0 body outline, 1 boundary. */
const CORE = 2

type Point = {
  /** Home position, in image widths, relative to the centre of the rings. */
  x: number
  y: number
  radius: number
  angle: number
  luma: number
  kind: number
  /** Which interval's shell this point belongs to. */
  band: number
  phase: number
}

const DATA = figureData as unknown as {
  width: number
  scale: number
  shellInner: number
  coreOuter: number
  maxRadius: number
  p: number[]
}

/**
 * How far in the interior rings are drawn, and how far out they are allowed to
 * open. Both were set by looking at the result: at 0.52 the core still filled
 * most of the torso, and letting it reach the boundary on a loud chord put the
 * disc back over the body, which is the thing this whole arrangement exists to
 * prevent. At these values the chest is a core the figure is visibly wearing.
 */
const CORE_SHRINK = 0.42
const CORE_MAX = 0.74

/**
 * Colours have to be resolved to numbers before the point loop, because the loop
 * is where all the time goes. Eight of these are worked out per frame — one per
 * interval for the core, one for the body — and every point then just scales the
 * three numbers it is given.
 */
function hslToRgb(hue: number, light: number, into: Float32Array, at: number) {
  const h = (((hue % 360) + 360) % 360) / 60
  const l = light / 100
  const c = (1 - Math.abs(2 * l - 1)) * 1 // saturation is always 100% here
  const x = c * (1 - Math.abs((h % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 1) [r, g, b] = [c, x, 0]
  else if (h < 2) [r, g, b] = [x, c, 0]
  else if (h < 3) [r, g, b] = [0, c, x]
  else if (h < 4) [r, g, b] = [0, x, c]
  else if (h < 5) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  into[at] = (r + m) * 255
  into[at + 1] = (g + m) * 255
  into[at + 2] = (b + m) * 255
}

/** Built once for the module — the geometry never changes. */
const POINTS: Point[] = (() => {
  const s = DATA.scale
  const out: Point[] = []
  for (let i = 0, n = 0; i < DATA.p.length; i += 4, n++) {
    const x = DATA.p[i] / s
    const y = DATA.p[i + 1] / s
    const radius = Math.hypot(x, y)
    const kind = DATA.p[i + 3]
    // The core spans the intervals across its own extent, so all seven rings of
    // the scale are present inside the chest; everything else bands by where it
    // sits in the figure, which sends the answer outward along the limbs.
    const fraction =
      kind === CORE ? radius / (DATA.shellInner / s) : radius / (DATA.maxRadius / s)
    out.push({
      x,
      y,
      radius,
      angle: Math.atan2(y, x),
      // Gamma, not the raw value: the render fades the legs and the far arm
      // almost to nothing, and a straight reading draws them as a few stray
      // specks. This lifts the dim end without touching the bright end.
      luma: Math.pow(DATA.p[i + 2] / 63, 0.82),
      kind,
      band: Math.min(BAND_COUNT - 1, Math.floor(fraction * BAND_COUNT)),
      // Deterministic, so the drift is stable across reloads.
      phase: ((n * 2654435761) % 1000) / 1000,
    })
  }
  return out
})()

/** Vertical extent of the body, so the figure can be fitted to any frame. */
const EXTENT = POINTS.reduce(
  (acc, p) =>
    p.kind === CORE
      ? acc
      : { top: Math.min(acc.top, p.y), bottom: Math.max(acc.bottom, p.y) },
  { top: 0, bottom: 0 },
)
const FIGURE_HEIGHT = EXTENT.bottom - EXTENT.top

/**
 * Dust across the whole frame, in fractions of it.
 *
 * The figure is a standing person and the stage is 16:9, so however well the
 * body is drawn there is a great deal of empty picture beside it. This fills it
 * with something that belongs to the sound: each mote is assigned an interval
 * and brightens on it, so the air around the figure carries the harmony too.
 * Generated from a fixed sequence rather than `Math.random`, so the sky is the
 * same every time the stage is opened.
 */
const DUST = (() => {
  let seed = 20250817
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  return Array.from({ length: 260 }, () => ({
    x: next(),
    y: next(),
    phase: next() * Math.PI * 2,
    size: 0.4 + next() * 1.1,
    band: Math.floor(next() * BAND_COUNT),
  }))
})()

export function FigureField({ playing, scale = 1, className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const rootId = useSession((s) => s.config.rootId)
  // Held in a ref so changing frequency retunes the reading on the next frame
  // instead of tearing down and restarting the animation.
  const rootHz = useRef(528)
  rootHz.current = getFrequency(rootId)?.hz ?? 528

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bloom = document.createElement('canvas')
    const bctx = bloom.getContext('2d')
    if (!bctx) return

    let raf = 0
    let t = 0
    let energy = 0
    const bands = new Float32Array(BAND_COUNT)
    const rise = new Float32Array(BAND_COUNT)
    /** Outward impulse per shell, from transients. Decays back to zero. */
    const impulse = new Float32Array(BAND_COUNT)
    const waves: { r: number; life: number; band: number }[] = []

    let w = 0
    let h = 0
    let dpr = 1
    const BLOOM_SCALE = 0.32

    /**
     * The figure is written straight into pixels rather than drawn.
     *
     * Thirty-seven thousand `fillRect` calls with a freshly built `hsla()` string
     * each, twice over for the bloom, measured at 350ms a frame — three frames a
     * second, on a picture whose entire purpose is to move with the music. Almost
     * all of it was the strings and the per-call state changes, not the pixels.
     *
     * So the points go into an `ImageData` by hand, at device resolution, added
     * rather than painted over — `Uint8ClampedArray` saturates on assignment, so
     * that is additive blending for free. Two buffers, the second at a third of
     * the size for the glow, and each frame is two `putImageData` calls instead
     * of seventy-four thousand draws.
     *
     * It is also the sharper way round: a point lands on a device pixel exactly,
     * with none of the smearing a sub-pixel `fillRect` does to it.
     */
    /** Interval colours for this frame, then the body's, as flat r,g,b. */
    const palette = new Float32Array((BAND_COUNT + 1) * 3)
    /** How much of a point's light goes into the glow buffer. */
    const BLOOM_GAIN = 0.5

    let field: ImageData | null = null
    let fieldWords: Uint32Array | null = null
    let bloomField: ImageData | null = null
    let bloomWords: Uint32Array | null = null

    const resize = () => {
      // Three, not two: the whole complaint about the first version was that it
      // was not sharp, and on a phone or a 4K panel the extra device pixels are
      // there.
      dpr = Math.min(window.devicePixelRatio || 1, 3)
      w = wrap.clientWidth
      h = wrap.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bloom.width = Math.max(1, Math.round(canvas.width * BLOOM_SCALE))
      bloom.height = Math.max(1, Math.round(canvas.height * BLOOM_SCALE))
      field = ctx.createImageData(canvas.width, canvas.height)
      fieldWords = new Uint32Array(field.data.buffer)
      bloomField = bctx.createImageData(bloom.width, bloom.height)
      bloomWords = new Uint32Array(bloomField.data.buffer)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const hueOf = () =>
      Number(getComputedStyle(document.documentElement).getPropertyValue('--h').trim()) || 265

    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!w || !h) return
      t += reducedMotion ? 0.003 : 0.01

      const spectrum = playing ? engine.getSpectrum() : null
      const wave = playing ? engine.getWaveform() : null
      const overall = readBands(bands, rise, spectrum, rootHz.current, engine.sampleRate, t)
      energy += (overall - energy) * 0.12

      for (let i = 0; i < BAND_COUNT; i++) {
        // A band that jumps kicks its shell outward, and sheds a wave.
        if (rise[i] > 0.05) {
          impulse[i] = Math.min(1, impulse[i] + rise[i] * 2.4)
          if (playing && !reducedMotion) waves.push({ r: 0, life: 1, band: i })
        }
        impulse[i] *= 0.93
      }

      const H = hueOf()
      // Fit the body to the frame with margin, and keep it centred on the rings.
      const unit = (h * 0.88) / FIGURE_HEIGHT
      const cx = w / 2
      const cy = h / 2 - (EXTENT.top + FIGURE_HEIGHT / 2) * unit

      // ---- The figure, written into pixels --------------------------------
      if (!field || !fieldWords || !bloomField || !bloomWords) return
      fieldWords.fill(0)
      bloomWords.fill(0)

      const px = field.data
      const bpx = bloomField.data
      const fw = field.width
      const fh = field.height
      const bw = bloomField.width
      const bh = bloomField.height

      for (let i = 0; i < BAND_COUNT; i++) {
        hslToRgb(H + i * 15, 70 + bands[i] * 24, palette, i * 3)
      }
      hslToRgb(H + 16, 90, palette, BAND_COUNT * 3)
      const bodyR = palette[BAND_COUNT * 3]
      const bodyG = palette[BAND_COUNT * 3 + 1]
      const bodyB = palette[BAND_COUNT * 3 + 2]

      const waveLen = wave?.length ?? 0
      // One source pixel, in device pixels. Sizing the splat by this rather than
      // by a constant is what keeps the line weight of the original drawing at
      // any resolution: the artwork's own stroke, neither thinned to dashes on a
      // 4K panel nor fattened to blobs on a phone.
      const splat = Math.max(1, Math.min(4, Math.round(((unit / DATA.width) * dpr) * 1.15)))

      for (let i = 0; i < POINTS.length; i++) {
        const p = POINTS[i]
        const band = bands[p.band]
        const isCore = p.kind === CORE

        // Radial displacement: the shell's own level, its transient impulse, the
        // global breath, and the waveform read at this point's angle. The core
        // starts compressed and opens; the body only breathes, because a body
        // pushed around this hard stops looking like one.
        let stretch = isCore
          ? CORE_SHRINK * (1 + band * 0.42 + impulse[p.band] * 0.5 + energy * 0.18)
          : 1 + band * 0.035 + impulse[p.band] * 0.055 + energy * 0.02
        if (waveLen) {
          const idx = ((((p.angle + Math.PI) / (Math.PI * 2)) * waveLen) | 0) % waveLen
          stretch += (wave![idx] ?? 0) * (isCore ? 0.16 : 0.05)
        }
        // Never out to the boundary it was cut from, so the core cannot swallow
        // the figure again at a peak.
        if (isCore && stretch > CORE_MAX) stretch = CORE_MAX
        const drift = reducedMotion ? 0 : Math.sin(t * 1.6 + p.phase * 42) * 0.0014

        const x = ((cx + (p.x * stretch + drift) * unit) * dpr) | 0
        const y = ((cy + (p.y * stretch + drift) * unit) * dpr) | 0
        if (x < 0 || y < 0 || x >= fw || y >= fh) continue

        // The body stays silver and legible whatever the music does; the core
        // takes the accent and shifts with its shell, so the harmonics are
        // readable as colour and not only as movement.
        let a = isCore
          ? p.luma * (0.34 + band * 0.8 + energy * 0.25)
          : p.luma * (0.9 + band * 0.3 + energy * 0.12)
        if (a > 1) a = 1
        const base = isCore ? p.band * 3 : -1
        const r = base < 0 ? bodyR * a : palette[base] * a
        const g = base < 0 ? bodyG * a : palette[base + 1] * a
        const b = base < 0 ? bodyB * a : palette[base + 2] * a

        for (let dy = 0; dy < splat; dy++) {
          const yy = y + dy
          if (yy >= fh) break
          let o = (yy * fw + x) * 4
          for (let dx = 0; dx < splat; dx++, o += 4) {
            if (x + dx >= fw) break
            px[o] += r
            px[o + 1] += g
            px[o + 2] += b
            px[o + 3] = 255
          }
        }

        // The same point, once, into the smaller buffer the glow comes from.
        const bx = (x * BLOOM_SCALE) | 0
        const by = (y * BLOOM_SCALE) | 0
        if (bx < bw && by < bh) {
          const o = (by * bw + bx) * 4
          bpx[o] += r * BLOOM_GAIN
          bpx[o + 1] += g * BLOOM_GAIN
          bpx[o + 2] += b * BLOOM_GAIN
          bpx[o + 3] = 255
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.putImageData(field, 0, 0)
      bctx.putImageData(bloomField, 0, 0)

      // The upscale is the blur: one drawImage, interpolated by the browser.
      ctx.globalCompositeOperation = 'lighter'
      ctx.imageSmoothingEnabled = true
      ctx.globalAlpha = 0.5 + energy * 0.3
      ctx.drawImage(bloom, 0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // ---- Ground bloom ---------------------------------------------------
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.5)
      glow.addColorStop(0, `hsla(${H + 20}, 100%, 62%, ${0.05 + energy * 0.12})`)
      glow.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // ---- Dust ------------------------------------------------------------
      for (let i = 0; i < DUST.length; i++) {
        const d = DUST[i]
        const twinkle = 0.5 + 0.5 * Math.sin(t * 1.1 + d.phase)
        const a = (0.05 + bands[d.band] * 0.55 + energy * 0.2) * twinkle
        if (a < 0.02) continue
        ctx.fillStyle = `hsla(${H + d.band * 14}, 100%, 86%, ${a})`
        ctx.fillRect(d.x * w, d.y * h, d.size * scale, d.size * scale)
      }

      // ---- Travelling waves, from the core out ----------------------------
      for (let i = waves.length - 1; i >= 0; i--) {
        const v = waves[i]
        v.r += unit * 0.012
        v.life -= 0.014
        if (v.life <= 0 || v.r > (DATA.maxRadius / DATA.scale) * unit * 1.2) {
          waves.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(cx, cy, v.r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${H + v.band * 14}, 100%, 74%, ${v.life * 0.18})`
        ctx.lineWidth = 0.8 * scale
        ctx.stroke()
      }

      // ---- Orbiting satellites, one per interval --------------------------
      /**
       * Wide, tilted ellipses rather than the circles this started with. A
       * television frame is far wider than a standing person, so circular orbits
       * sized to fit the height left two thirds of the picture empty; these
       * sweep out past the figure and give the sides something to do. Each
       * interval gets its own tilt, so the orbits cross instead of nesting.
       */
      RATIOS.forEach((ratio, i) => {
        const band = bands[i]
        const reach = Math.min(w, h) * 0.44
        const spread = reach * (0.55 + (ratio / MAX_RATIO) * 0.6) * (1 + band * 0.08)
        const rx = spread * 1.55
        const ry = spread * 0.34
        const tilt = i * 0.42
        const cos = Math.cos(tilt)
        const sin = Math.sin(tilt)
        const hue = H + i * 16

        // The path itself, faintly. Without it the satellites read as scattered
        // dots; with it they are visibly going somewhere, and the crossing
        // ellipses are what give the empty sides of a wide frame their shape.
        ctx.beginPath()
        ctx.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue}, 100%, 76%, ${0.045 + band * 0.16})`
        ctx.lineWidth = 0.7 * scale
        ctx.stroke()

        // A short trail, drawn as the same orbit a few frames behind. It is what
        // turns a dot into something that is visibly travelling.
        for (let k = 5; k >= 0; k--) {
          const a = (t - k * 0.06) * ratio * 0.5 - Math.PI / 2
          const ox = Math.cos(a) * rx
          const oy = Math.sin(a) * ry
          const x = cx + ox * cos - oy * sin
          const y = cy + ox * sin + oy * cos
          const fade = 1 - k / 6
          ctx.beginPath()
          ctx.arc(x, y, (0.9 + band * 3.4) * fade * scale, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${hue}, 100%, 84%, ${(0.3 + band * 0.6) * fade * fade})`
          if (k === 0) {
            ctx.shadowBlur = (10 + band * 30) * scale
            ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.9)`
          }
          ctx.fill()
          ctx.shadowBlur = 0
        }
      })

      ctx.globalCompositeOperation = 'source-over'
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [playing, reducedMotion, scale])

  return (
    // The caller may position this itself (the stage fills a 16:9 box with it);
    // combining its class with `relative` would apply two position values and
    // collapse the box to nothing.
    <div ref={wrapRef} className={className || 'relative'}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
