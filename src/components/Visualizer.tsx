import { useEffect, useRef } from 'react'
import { JUST_MAJOR } from '../audio/scale'
import { engine } from '../audio/ToneEngine'
import { getFrequency } from '../lib/catalog'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'

type Props = {
  playing: boolean
  /** Rendered inside the orb — the frequency readout. */
  children?: React.ReactNode
}

const RATIOS = JUST_MAJOR
const MAX_RATIO = RATIOS[RATIOS.length - 1]

/**
 * Octaves searched for each interval, and the window they must fall in.
 *
 * Both were chosen by measurement, not taste. A bin is ~21.5 Hz wide, so low
 * down it spans well over a semitone and neighbouring intervals land in the
 * same bin: reading five octaves with a three-bin window scored 0 frames out of
 * 260 where a scale interval beat a deliberately off-scale probe — it was
 * measuring loudness, not harmony. Restricted to these three octaves above
 * 300 Hz, reading the nearest bin only, the scale wins 260 frames out of 260.
 */
const OCTAVES = [0, 1, 2]
const MIN_HZ = 300
const MAX_HZ = 6000
/**
 * The dB window a ring maps across, measured rather than picked: over 260
 * frames of real playback the active bins sat between about -80 and -48, so a
 * wider window left every ring parked near 0.1 and visually inert.
 */
const DB_FLOOR = -80
const DB_RANGE = 36

/**
 * The player's visualiser: the opening animation, driven by the audio.
 *
 * The splash screen draws the app's thesis — a root at the centre and one ring
 * per interval of the just-intonation scale, each at a radius proportional to
 * its ratio, each carrying a satellite whose angular speed IS that ratio. This
 * is the same figure, except that the rings are no longer only decorative:
 * every ring is tuned to its own interval and reads the spectrum at that pitch.
 *
 * That is the part worth being precise about. Ring 3/2 measures the level at
 * `root × 3/2` — over the octaves the melody actually spreads it across — so
 * when the music plays a fifth, the fifth's ring is the one that flares. A
 * generic bar-spectrum would move too, but it would not tell you anything;
 * this shows which harmonic relation is sounding, which is the only claim the
 * app makes about its own sound.
 *
 * How well it separates was measured rather than assumed, against probes placed
 * deliberately off the scale: in 260 frames out of 260 the loudest scale
 * interval read louder than the loudest off-scale one. On the mean the margin
 * is about 3 dB, so this is a real bias and not a spectrograph — enough to
 * drive the picture, not enough to read a chord off the screen.
 *
 * Drawn additively on black, so overlapping glows accumulate into light instead
 * of muddying, and at device-pixel resolution so the hairlines stay hairlines.
 */
export function Visualizer({ playing, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const theme = useSettings((s) => s.theme)
  const rootId = useSession((s) => s.config.rootId)
  const rootHz = getFrequency(rootId)?.hz ?? 528

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let t = 0
    /** Smoothed overall level, so the core swells rather than flickers. */
    let energy = 0
    /** One smoothed level per ring, and its previous value for transients. */
    const ringEnergy = RATIOS.map(() => 0)
    const pulses: { r: number; life: number; hue: number }[] = []

    const resize = () => {
      // Capped at 3: past that the pixels cost fill rate and buy nothing a
      // display can resolve.
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const size = wrap.clientWidth
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const hueOf = () =>
      Number(getComputedStyle(document.documentElement).getPropertyValue('--h').trim()) || 265
    const isLight = () => document.documentElement.classList.contains('theme-light')

    /** Level at one pitch, taken from the loudest octave it can sound in. */
    const levelAt = (spectrum: Float32Array, hz: number, binHz: number) => {
      let best = 0
      for (const oct of OCTAVES) {
        const f = hz * Math.pow(2, oct)
        if (f < MIN_HZ || f > MAX_HZ) continue
        const bin = Math.round(f / binHz)
        if (bin < 0 || bin >= spectrum.length) continue
        const db = spectrum[bin]
        if (!Number.isFinite(db)) continue
        best = Math.max(best, Math.min(1, Math.max(0, (db - DB_FLOOR) / DB_RANGE)))
      }
      return best
    }

    const draw = () => {
      raf = requestAnimationFrame(draw)
      t += reducedMotion ? 0.003 : 0.01

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2 - 4

      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'

      const spectrum = playing ? engine.getSpectrum() : null
      const wave = playing ? engine.getWaveform() : null
      const H = hueOf()
      const light = isLight()
      const strokeL = light ? 46 : 78
      const glow = light ? 0.3 : 1
      const binHz = spectrum?.length ? engine.sampleRate / (2 * spectrum.length) : 1

      // ---- Levels ---------------------------------------------------------
      let overall = 0
      for (let i = 0; i < RATIOS.length; i++) {
        const target = spectrum
          ? levelAt(spectrum, rootHz * RATIOS[i], binHz)
          : // Idle: a slow wander so the figure is alive but clearly not reacting.
            0.12 + Math.sin(t * 0.7 + i * 0.9) * 0.06
        const prev = ringEnergy[i]
        // Fast attack, slow release — the shape of a note, not of a slider.
        ringEnergy[i] += (target - prev) * (target > prev ? 0.35 : 0.06)
        overall += ringEnergy[i]
        // A ring that jumps sheds a pulse.
        if (playing && !reducedMotion && ringEnergy[i] - prev > 0.06) {
          pulses.push({ r: R * (RATIOS[i] / MAX_RATIO) * 0.92, life: 1, hue: H + i * 15 })
        }
      }
      overall /= RATIOS.length
      energy += (overall - energy) * 0.12

      // Everything below is additive: glows sum into light on a black ground
      // rather than painting over each other.
      ctx.globalCompositeOperation = light ? 'source-over' : 'lighter'

      // ---- Bloom ----------------------------------------------------------
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      bloom.addColorStop(0, `hsla(${H + 25}, 100%, ${light ? 62 : 70}%, ${(light ? 0.2 : 0.26) + energy * 0.32})`)
      bloom.addColorStop(0.42, `hsla(${H}, 100%, 58%, ${0.05 + energy * 0.12})`)
      bloom.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, w, h)

      // ---- Transient pulses ----------------------------------------------
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.r += R * 0.006
        p.life -= 0.02
        if (p.life <= 0 || p.r > R * 1.05) {
          pulses.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(cx, cy, p.r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${p.hue}, 100%, ${strokeL}%, ${p.life * 0.34})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // ---- Harmonic rings -------------------------------------------------
      RATIOS.forEach((ratio, i) => {
        const e = ringEnergy[i]
        const base = R * (ratio / MAX_RATIO) * 0.92
        // The ring breathes outward on its own level, so a loud interval is
        // visibly wider than a quiet one and not merely brighter.
        const radius = base * (1 + e * 0.09)
        const hue = H + i * 15

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue}, 100%, ${strokeL}%, ${(light ? 0.5 : 0.34) + e * 0.6})`
        ctx.lineWidth = 1 + e * 2.2
        ctx.shadowBlur = (10 + e * 40) * glow
        ctx.shadowColor = `hsla(${hue}, 100%, 68%, ${(0.5 + e * 0.5) * glow})`
        ctx.stroke()
        ctx.shadowBlur = 0

        // Satellite: angular speed is the ratio, exactly as on the splash, so
        // the figure drifts apart and snaps back on the period of the scale.
        const angle = t * ratio * 0.62 - Math.PI / 2
        const px = cx + Math.cos(angle) * radius
        const py = cy + Math.sin(angle) * radius

        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(px, py)
        ctx.strokeStyle = `hsla(${hue}, 100%, ${light ? 50 : 80}%, ${0.05 + e * 0.22})`
        ctx.lineWidth = 0.7
        ctx.stroke()

        const dotR = 2 + e * 5.5
        ctx.beginPath()
        ctx.arc(px, py, dotR, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, 100%, ${light ? 48 : 90}%, ${0.6 + e * 0.4})`
        ctx.shadowBlur = (12 + e * 38) * glow
        ctx.shadowColor = `hsla(${hue}, 100%, 74%, ${0.9 * glow})`
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // ---- Waveform, deforming the outer edge -----------------------------
      const edge = R * 0.985
      ctx.beginPath()
      for (let i = 0; i <= 240; i++) {
        const a = (i / 240) * Math.PI * 2 - Math.PI / 2
        const sample = wave?.length
          ? (wave[Math.floor((i / 240) * wave.length)] ?? 0)
          : Math.sin(t * 2 + i * 0.13) * 0.03
        const r = edge + sample * R * 0.1
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = `hsla(${H + 30}, 100%, ${light ? 45 : 84}%, ${0.3 + energy * 0.5})`
      ctx.lineWidth = 1.2
      ctx.shadowBlur = 16 * glow
      ctx.shadowColor = `hsla(${H + 30}, 100%, 74%, ${0.85 * glow})`
      ctx.stroke()
      ctx.shadowBlur = 0

      // ---- The root, on top ------------------------------------------------
      const breathe = reducedMotion ? 1 : 1 + Math.sin(t * 1.7) * 0.05
      const coreR = R * 0.088 * breathe * (1 + energy * 0.35)
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.2)
      core.addColorStop(0, light ? `hsla(${H + 20}, 90%, 46%, 0.98)` : `hsla(0,0%,100%,${0.85 + energy * 0.15})`)
      core.addColorStop(0.22, `hsla(${H + 30}, 100%, ${light ? 55 : 86}%, ${0.7 + energy * 0.3})`)
      core.addColorStop(1, `hsla(${H}, 100%, 60%, 0)`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 3.2, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalCompositeOperation = 'source-over'
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [playing, reducedMotion, rootHz, theme])

  return (
    <div ref={wrapRef} className="relative mx-auto aspect-square w-full max-w-[min(78vw,380px)]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {children}
      </div>
    </div>
  )
}
