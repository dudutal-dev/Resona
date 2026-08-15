import { useEffect, useRef } from 'react'
import { engine } from '../audio/ToneEngine'
import { useSettings } from '../store/settingsStore'

type Props = {
  playing: boolean
  /** Rendered inside the orb — the frequency readout. */
  children?: React.ReactNode
}

/**
 * The radial visualiser. Reads the master analyser and draws, from the inside
 * out: a breathing core orb, a waveform ring, a radial spectrum, and expanding
 * pulse rings. Everything is drawn at device-pixel resolution so it stays sharp
 * on high-DPI screens.
 *
 * When nothing is playing it falls back to a slow synthetic breath, so the
 * screen is never dead.
 */
export function Visualizer({ playing, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let t = 0
    // Smoothed energy, so the orb swells rather than flickers.
    let energy = 0
    const pulses: { r: number; life: number }[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
      const size = wrap.clientWidth
      canvas.width = size * dpr
      canvas.height = size * dpr
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const hue = () =>
      Number(getComputedStyle(document.documentElement).getPropertyValue('--h').trim()) || 265

    const draw = () => {
      raf = requestAnimationFrame(draw)
      t += reducedMotion ? 0.004 : 0.012

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(w, h) / 2

      ctx.clearRect(0, 0, w, h)

      const spectrum = playing ? engine.getSpectrum() : null
      const wave = playing ? engine.getWaveform() : null
      const H = hue()

      // ---- Energy ---------------------------------------------------------
      let level = 0
      if (spectrum && spectrum.length) {
        let sum = 0
        let count = 0
        for (let i = 0; i < spectrum.length; i++) {
          const db = spectrum[i]
          if (Number.isFinite(db)) {
            sum += Math.max(0, (db + 100) / 100)
            count++
          }
        }
        level = count ? sum / count : 0
      } else {
        level = 0.25 + Math.sin(t * 0.5) * 0.08
      }
      energy += (level - energy) * 0.08

      const breath = 1 + Math.sin(t * 0.55) * 0.035 + energy * 0.14

      // ---- Outer halo -----------------------------------------------------
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius)
      halo.addColorStop(0, `hsla(${H}, 95%, 65%, ${0.16 + energy * 0.22})`)
      halo.addColorStop(0.55, `hsla(${H + 40}, 95%, 60%, ${0.06 + energy * 0.1})`)
      halo.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = halo
      ctx.fillRect(0, 0, w, h)

      // ---- Expanding pulse rings -----------------------------------------
      if (playing && !reducedMotion && Math.random() < 0.012 + energy * 0.03) {
        pulses.push({ r: radius * 0.32, life: 1 })
      }
      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]
        p.r += radius * 0.0035
        p.life -= 0.006
        if (p.life <= 0 || p.r > radius) {
          pulses.splice(i, 1)
          continue
        }
        ctx.beginPath()
        ctx.arc(cx, cy, p.r, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${H}, 95%, 72%, ${p.life * 0.28})`
        ctx.lineWidth = 1.2
        ctx.stroke()
      }

      // ---- Radial spectrum ------------------------------------------------
      const bars = 96
      const inner = radius * 0.62
      ctx.lineCap = 'round'
      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2
        let mag: number
        if (spectrum && spectrum.length) {
          // Log-ish index mapping so low frequencies get more of the circle.
          const idx = Math.floor(Math.pow(i / bars, 1.6) * spectrum.length)
          const db = spectrum[Math.min(spectrum.length - 1, idx)]
          mag = Number.isFinite(db) ? Math.max(0, (db + 95) / 95) : 0
        } else {
          mag = 0.12 + Math.sin(t * 1.4 + i * 0.28) * 0.06 + Math.sin(t * 0.6 + i * 0.11) * 0.04
        }
        const len = radius * 0.06 + mag * radius * 0.3
        const x1 = cx + Math.cos(angle) * inner
        const y1 = cy + Math.sin(angle) * inner
        const x2 = cx + Math.cos(angle) * (inner + len)
        const y2 = cy + Math.sin(angle) * (inner + len)

        const shade = H + (i / bars) * 50
        ctx.strokeStyle = `hsla(${shade}, 95%, ${62 + mag * 18}%, ${0.28 + mag * 0.55})`
        ctx.lineWidth = 2.4
        ctx.shadowBlur = 12
        ctx.shadowColor = `hsla(${shade}, 95%, 65%, 0.6)`
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      // ---- Waveform ring --------------------------------------------------
      const ringR = radius * 0.5
      ctx.beginPath()
      for (let i = 0; i <= 180; i++) {
        const a = (i / 180) * Math.PI * 2 - Math.PI / 2
        let sample = 0
        if (wave && wave.length) sample = wave[Math.floor((i / 180) * wave.length)] ?? 0
        else sample = Math.sin(t * 2 + i * 0.14) * 0.06
        const r = ringR + sample * radius * 0.14
        const x = cx + Math.cos(a) * r
        const y = cy + Math.sin(a) * r
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.strokeStyle = `hsla(${H + 25}, 100%, 78%, ${0.35 + energy * 0.4})`
      ctx.lineWidth = 1.6
      ctx.shadowBlur = 18
      ctx.shadowColor = `hsla(${H + 25}, 100%, 70%, 0.8)`
      ctx.stroke()
      ctx.shadowBlur = 0

      // ---- Core orb -------------------------------------------------------
      const coreR = radius * 0.4 * breath
      const core = ctx.createRadialGradient(
        cx - coreR * 0.25,
        cy - coreR * 0.3,
        coreR * 0.1,
        cx,
        cy,
        coreR,
      )
      core.addColorStop(0, `hsla(${H + 30}, 100%, 88%, ${0.5 + energy * 0.35})`)
      core.addColorStop(0.45, `hsla(${H}, 95%, 62%, ${0.28 + energy * 0.25})`)
      core.addColorStop(1, `hsla(${H - 20}, 90%, 40%, 0.02)`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.fill()

      ctx.beginPath()
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2)
      ctx.strokeStyle = `hsla(${H + 20}, 100%, 85%, ${0.22 + energy * 0.3})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [playing, reducedMotion])

  return (
    <div ref={wrapRef} className="relative mx-auto aspect-square w-full max-w-[min(78vw,380px)]">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        {children}
      </div>
    </div>
  )
}
