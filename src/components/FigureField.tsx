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
 * The source artwork is a body drawn in starlight with concentric rings around
 * the chest. It is not shown as a picture — `scripts/extract-figure.mjs` reduces
 * it to about nine and a half thousand points, and this draws those points
 * itself, every frame. That is the whole reason for the detour: a picture can
 * be lit and faded, but only a point cloud can be *moved*, and moving is what
 * makes it belong to the sound.
 *
 * Four things move it, in rising order of how much they matter:
 *
 *   1. A slow per-point drift, so nothing is ever perfectly still.
 *   2. A global breath on the overall level, so the body swells as it plays.
 *   3. The waveform, sampled by the angle each point sits at, pushing it in and
 *      out along its own radius. This is the literal sound shape, on the body.
 *   4. Its shell. Every point knows its distance from the centre of the rings,
 *      and that distance maps to one interval of the just scale. So the rings
 *      the artwork already contains each expand on their own harmonic: when a
 *      fifth sounds, the fifth's shell is the one that opens.
 *
 * A transient in a band fires an impulse into its shell, which travels outward
 * and settles — the figure visibly answers a note being struck.
 *
 * The glow is a second pass at a fifth of the resolution, upscaled: browsers
 * interpolate that for free, which is a real bloom for the cost of one
 * drawImage rather than nine thousand shadowed fills.
 */

type Props = {
  playing: boolean
  /** Drives point size and text scale — a TV is looked at from much further. */
  scale?: number
  className?: string
  /** Handed the canvas once mounted, so it can be captured for casting. */
  onCanvas?: (canvas: HTMLCanvasElement) => void
}

type Point = {
  /** Home position, normalised, relative to the centre of the rings. */
  x: number
  y: number
  radius: number
  angle: number
  luma: number
  /** 0 body dust, 1 and 2 the coloured ring strokes. */
  kind: number
  /** Which interval's shell this point belongs to. */
  band: number
  phase: number
}

const DATA = figureData as unknown as {
  centre: [number, number]
  maxRadius: number
  points: [number, number, number, number][]
}

/** Built once for the module — the geometry never changes. */
const POINTS: Point[] = DATA.points.map(([x, y, luma, kind], i) => {
  const radius = Math.hypot(x, y)
  return {
    x,
    y,
    radius,
    angle: Math.atan2(y, x),
    luma,
    kind,
    band: Math.min(BAND_COUNT - 1, Math.floor((radius / DATA.maxRadius) * BAND_COUNT)),
    // Deterministic, so the drift is stable across reloads.
    phase: ((i * 2654435761) % 1000) / 1000,
  }
})

/** Vertical extent, so the figure can be fitted to any frame. */
const EXTENT = POINTS.reduce(
  (acc, p) => ({ top: Math.min(acc.top, p.y), bottom: Math.max(acc.bottom, p.y) }),
  { top: 0, bottom: 0 },
)
const FIGURE_HEIGHT = EXTENT.bottom - EXTENT.top

export function FigureField({ playing, scale = 1, className = '', onCanvas }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const rootId = useSession((s) => s.config.rootId)
  // Held in a ref so changing frequency retunes the reading on the next frame
  // instead of tearing down and restarting the animation.
  const rootHz = useRef(528)
  rootHz.current = getFrequency(rootId)?.hz ?? 528
  // Callers pass this inline, and the stage re-renders once a second for the
  // clock. In the dependency list it would tear down and restart the animation
  // every one of those renders.
  const onCanvasRef = useRef(onCanvas)
  onCanvasRef.current = onCanvas

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
    const BLOOM_SCALE = 0.2

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      w = wrap.clientWidth
      h = wrap.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      bloom.width = Math.max(1, Math.round(w * BLOOM_SCALE))
      bloom.height = Math.max(1, Math.round(h * BLOOM_SCALE))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    onCanvasRef.current?.(canvas)

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
      const unit = (h * 0.86) / FIGURE_HEIGHT
      const cx = w / 2
      const cy = h / 2 - (EXTENT.top + FIGURE_HEIGHT / 2) * unit

      ctx.clearRect(0, 0, w, h)
      bctx.clearRect(0, 0, bloom.width, bloom.height)
      ctx.globalCompositeOperation = 'lighter'
      bctx.globalCompositeOperation = 'lighter'

      // ---- Ground bloom ---------------------------------------------------
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.5)
      glow.addColorStop(0, `hsla(${H + 20}, 100%, 62%, ${0.06 + energy * 0.14})`)
      glow.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)

      // ---- Travelling waves, from the centre out --------------------------
      for (let i = waves.length - 1; i >= 0; i--) {
        const v = waves[i]
        v.r += unit * 0.012
        v.life -= 0.014
        if (v.life <= 0 || v.r > DATA.maxRadius * unit * 1.6) {
          waves.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(cx, cy, v.r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${H + v.band * 14}, 100%, 74%, ${v.life * 0.22})`
        ctx.lineWidth = 1 * scale
        ctx.stroke()
      }

      // ---- The body -------------------------------------------------------
      const waveLen = wave?.length ?? 0
      const dot = Math.max(1, 1.05 * scale)
      // One pixel in the bloom buffer is five on screen; more than that and the
      // dense ring region sums straight to white.
      const bloomDot = Math.max(1, 0.9 * scale)

      for (let i = 0; i < POINTS.length; i++) {
        const p = POINTS[i]
        const band = bands[p.band]

        // Radial displacement: the shell's own level, its transient impulse,
        // the global breath, and the waveform read at this point's angle.
        let stretch = 1 + band * 0.09 + impulse[p.band] * 0.16 + energy * 0.03
        if (waveLen) {
          const idx = ((((p.angle + Math.PI) / (Math.PI * 2)) * waveLen) | 0) % waveLen
          stretch += (wave![idx] ?? 0) * 0.18
        }
        const drift = reducedMotion ? 0 : Math.sin(t * 1.6 + p.phase * 42) * 0.0016

        const x = cx + (p.x * stretch + drift) * unit
        const y = cy + (p.y * stretch + drift) * unit

        // Body dust stays silver; the ring strokes take the accent and shift
        // with their shell, so the harmonics are legible as colour too.
        const hue = p.kind === 0 ? H + 18 : H + p.band * 16
        const light = p.kind === 0 ? 88 : 68 + band * 22
        const alpha = Math.min(1, p.luma * (0.26 + band * 0.5 + energy * 0.22))

        ctx.fillStyle = `hsla(${hue}, 100%, ${light}%, ${alpha})`
        ctx.fillRect(x, y, dot, dot)

        // Same points, a fifth of the size, into the bloom buffer.
        bctx.fillStyle = `hsla(${hue}, 100%, ${light}%, ${alpha * 0.14})`
        bctx.fillRect(x * BLOOM_SCALE, y * BLOOM_SCALE, bloomDot, bloomDot)
      }

      // The upscale is the blur: one drawImage, interpolated by the browser.
      ctx.globalAlpha = 0.5 + energy * 0.35
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(bloom, 0, 0, w, h)
      ctx.globalAlpha = 1

      // ---- Orbiting satellites, one per interval --------------------------
      RATIOS.forEach((ratio, i) => {
        const band = bands[i]
        // Sized against the frame rather than the figure, so the widest orbit
        // still lands inside the picture on any aspect.
        const reach = Math.min(w, h) * 0.42
        const r = reach * (0.5 + (ratio / MAX_RATIO) * 0.5) * (1 + band * 0.06)
        const a = t * ratio * 0.5 - Math.PI / 2
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r * 0.78
        ctx.beginPath()
        ctx.arc(x, y, (1.6 + band * 4) * scale, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${H + i * 16}, 100%, 84%, ${0.35 + band * 0.6})`
        ctx.shadowBlur = (10 + band * 30) * scale
        ctx.shadowColor = `hsla(${H + i * 16}, 100%, 70%, 0.9)`
        ctx.fill()
        ctx.shadowBlur = 0
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
