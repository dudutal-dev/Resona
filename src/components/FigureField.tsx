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
 * `scripts/extract-figure.mjs` reduces the source artwork to some thirty-eight
 * thousand points and this draws every one of them itself, every frame. That is
 * the whole reason for the detour: a picture can be lit and faded, but only a
 * point cloud can be *moved*, and moving is what makes it belong to the sound.
 *
 * The mapping from sound to picture is the artwork's own. Its colour runs from
 * red at the feet through the spectrum to violet at the crown, which is the same
 * order as the intervals of the just scale, so height is the axis: the figure is
 * cut into seven horizontal shells, each answering to one interval. Play a fifth
 * and the fifth's height is what lights, opens and throws a wave. Nothing is
 * assigned arbitrarily — the picture already knew.
 *
 * Four things move the points, in rising order of how much they matter:
 *
 *   1. A slow per-point drift, so nothing is ever perfectly still.
 *   2. A global breath on the overall level.
 *   3. The waveform, read at the height each point sits at and pushing it
 *      sideways from the midline — the sound as a standing wave on the body.
 *   4. Its shell's level, which brightens it and opens it outward.
 *
 * A transient in a band fires an impulse into its shell, which travels outward
 * and settles, so the figure visibly answers a note being struck.
 *
 * Colour is rotated, not replaced: every point keeps the hue it had in the
 * artwork, turned by the difference between the cloud's own mean hue and the
 * accent of the frequency being played. So the figure follows the app's colour
 * without losing the spectrum that made it worth using.
 *
 * The points are written straight into an `ImageData` rather than drawn. Tens of
 * thousands of `fillRect` calls with a freshly built `hsla()` string each, twice
 * over for the glow, measured at 350ms a frame; writing pixels by hand and
 * letting `Uint8ClampedArray` saturate — which is additive blending for free —
 * measures around 5ms, and puts each point on a device pixel exactly instead of
 * smearing it across four.
 */

type Props = {
  playing: boolean
  /** Drives satellite and dust size — a television is looked at from further. */
  scale?: number
  className?: string
}

type Point = {
  /** Home position, in image widths, relative to the centre of the figure. */
  x: number
  y: number
  luma: number
  /** Hue as the artwork had it, in degrees. */
  hue: number
  /** A lit point in the body rather than the body itself. */
  node: boolean
  /** Which interval's shell this point belongs to: 0 at the feet. */
  band: number
  phase: number
}

const DATA = figureData as unknown as {
  width: number
  scale: number
  top: number
  bottom: number
  baseHue: number
  p: number[]
}

const FIGURE_TOP = DATA.top / DATA.scale
const FIGURE_BOTTOM = DATA.bottom / DATA.scale
const FIGURE_HEIGHT = FIGURE_BOTTOM - FIGURE_TOP

/** Built once for the module — the geometry never changes. */
const POINTS: Point[] = (() => {
  const s = DATA.scale
  const out: Point[] = []
  for (let i = 0, n = 0; i < DATA.p.length; i += 4, n++) {
    const y = DATA.p[i + 1] / s
    const hk = DATA.p[i + 3]
    // From the feet up, so the lowest interval sits at the base of the figure.
    const height = (FIGURE_BOTTOM - y) / FIGURE_HEIGHT
    out.push({
      x: DATA.p[i] / s,
      y,
      // Gamma, not the raw value: the render draws the legs and the far arm far
      // dimmer than the chest, and a straight reading leaves them as specks.
      luma: Math.pow(DATA.p[i + 2] / 63, 0.8),
      hue: ((hk >> 1) / 64) * 360,
      node: (hk & 1) === 1,
      band: Math.max(0, Math.min(BAND_COUNT - 1, Math.floor(height * BAND_COUNT))),
      // Deterministic, so the drift is stable across reloads.
      phase: ((n * 2654435761) % 1000) / 1000,
    })
  }
  return out
})()

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

/**
 * Colours are resolved to numbers before the point loop, because the loop is
 * where all the time goes. The whole palette is rebuilt each frame — it has to
 * be, the accent moves — and every point then just scales the three numbers its
 * hue bucket gives it.
 */
function hslToRgb(hue: number, light: number, into: Float32Array, at: number) {
  const h = (((hue % 360) + 360) % 360) / 60
  const l = light / 100
  const c = 1 - Math.abs(2 * l - 1) // saturation is always 100% here
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

/**
 * Hue buckets in the palette. Fine enough that the spectrum reads as continuous,
 * few enough that rebuilding all of them every frame costs nothing.
 */
const HUE_STEPS = 48

/** How far the figure's colour follows the accent. See the note where it is used. */
const HUE_FOLLOW = 0.34

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

    /** Two lightnesses per hue bucket: the body's, and a lit point's. */
    const palette = new Float32Array(HUE_STEPS * 6)
    /** How much of a point's light goes into the glow buffer. */
    const BLOOM_GAIN = 0.5

    let w = 0
    let h = 0
    let dpr = 1
    const BLOOM_SCALE = 0.32

    let field: ImageData | null = null
    let fieldWords: Uint32Array | null = null
    let bloomField: ImageData | null = null
    let bloomWords: Uint32Array | null = null

    const resize = () => {
      // Three, not two: sharpness was the whole complaint about the first
      // version, and on a phone or a 4K panel the extra device pixels are there.
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
      if (!field || !fieldWords || !bloomField || !bloomWords) return
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
      /**
       * The spectrum leans toward the accent rather than being turned onto it.
       *
       * A full rotation is what this first did, and it costs the thing the
       * artwork was chosen for: at 528Hz the accent is green and the cloud's mean
       * hue is 324, so every point turned by 184 degrees — the figure came out
       * with green hair, a magenta chest and cyan legs, which is the artwork's
       * own order inverted. A third of the way keeps red at the feet and violet
       * at the crown while the whole body still visibly changes colour with the
       * frequency, which is what the app's accent is for.
       */
      const turn = (H - DATA.baseHue) * HUE_FOLLOW
      for (let i = 0; i < HUE_STEPS; i++) {
        const hue = (i / HUE_STEPS) * 360 + turn
        hslToRgb(hue, 64, palette, i * 6)
        hslToRgb(hue, 88, palette, i * 6 + 3)
      }

      // Fit the figure to the frame with margin, and centre it.
      const unit = (h * 0.9) / FIGURE_HEIGHT
      const cx = w / 2
      const cy = h / 2 - (FIGURE_TOP + FIGURE_HEIGHT / 2) * unit

      const px = field.data
      const bpx = bloomField.data
      const fw = field.width
      const fh = field.height
      const bw = bloomField.width
      const bh = bloomField.height
      fieldWords.fill(0)
      bloomWords.fill(0)

      const waveLen = wave?.length ?? 0
      // One source pixel, in device pixels. Sizing the splat by this rather than
      // by a constant keeps the artwork's own line weight at any resolution:
      // neither thinned to dashes on a 4K panel nor fattened to blobs on a phone.
      const splat = Math.max(1, Math.min(4, Math.round((unit / DATA.width) * dpr * 1.15)))

      for (let i = 0; i < POINTS.length; i++) {
        const p = POINTS[i]
        const band = bands[p.band]

        // The shell opens outward from the midline, and the waveform pushes the
        // body sideways at the height it is read at — a standing wave on a
        // person. Vertically it barely moves: a body that slides up and down
        // stops reading as one.
        let sway = band * 0.05 + impulse[p.band] * 0.09
        if (waveLen) {
          const idx = ((((FIGURE_BOTTOM - p.y) / FIGURE_HEIGHT) * waveLen) | 0) % waveLen
          sway += (wave![idx] ?? 0) * 0.14
        }
        const drift = reducedMotion ? 0 : Math.sin(t * 1.6 + p.phase * 42) * 0.0016

        const x = ((cx + (p.x * (1 + sway) + drift) * unit) * dpr) | 0
        const y = ((cy + (p.y * (1 + energy * 0.012) + drift) * unit) * dpr) | 0
        if (x < 0 || y < 0 || x >= fw || y >= fh) continue

        let a = p.node
          ? p.luma * (0.4 + band * 0.9 + energy * 0.3)
          : p.luma * (0.62 + band * 0.45 + energy * 0.16)
        if (a > 1) a = 1

        const slot = ((((p.hue / 360) * HUE_STEPS) | 0) % HUE_STEPS) * 6 + (p.node ? 3 : 0)
        const r = palette[slot] * a
        const g = palette[slot + 1] * a
        const b = palette[slot + 2] * a

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
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.55)
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

      // ---- Waves, out from the height of the band that struck --------------
      /**
       * Centred on the shell that fired rather than on the figure, and flattened:
       * a note struck at the throat opens at the throat, and spreads across the
       * frame rather than up out of it.
       */
      for (let i = waves.length - 1; i >= 0; i--) {
        const v = waves[i]
        v.r += unit * 0.014
        v.life -= 0.016
        if (v.life <= 0 || v.r > Math.max(w, h)) {
          waves.splice(i, 1)
          continue
        }
        const shell = FIGURE_BOTTOM - ((v.band + 0.5) / BAND_COUNT) * FIGURE_HEIGHT
        ctx.beginPath()
        ctx.ellipse(cx, cy + shell * unit, v.r, v.r * 0.55, 0, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${H + v.band * 14}, 100%, 74%, ${v.life * 0.16})`
        ctx.lineWidth = 0.8 * scale
        ctx.stroke()
      }

      // ---- Orbiting satellites, one per interval --------------------------
      /**
       * Wide, tilted ellipses. A television frame is far wider than a standing
       * person, so circular orbits sized to fit the height left two thirds of the
       * picture empty; these sweep out past the figure and give the sides
       * something to do. Each interval gets its own tilt, so the orbits cross
       * instead of nesting.
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
    // The caller may position this itself (the stage fills the screen with it);
    // combining its class with `relative` would apply two position values and
    // collapse the box to nothing.
    <div ref={wrapRef} className={className || 'relative'}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
