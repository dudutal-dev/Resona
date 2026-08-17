import { useT } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { JUST_MAJOR } from '../audio/scale'
import { engine } from '../audio/ToneEngine'
import { useSettings } from '../store/settingsStore'

/**
 * Opening screen.
 *
 * The animation is the app's own thesis drawn out: a single point — the root
 * frequency — blooms into one ring per interval of the just-intonation scale,
 * each ring placed at a radius proportional to its ratio and carrying a
 * satellite whose angular speed is that same ratio. Faster ratios really do
 * orbit faster, so the rings drift apart and periodically snap back into
 * alignment. That recurring alignment is what consonance looks like.
 *
 * It also earns its keep functionally: browsers refuse to start audio without a
 * user gesture, so the tap that dismisses this screen is used to open the
 * AudioContext up front. The first press of play then makes sound immediately
 * instead of paying for the handshake.
 */

const RATIOS = JUST_MAJOR
const MAX_RATIO = RATIOS[RATIOS.length - 1]

/** Rings settle one after another rather than all at once. */
const RING_DELAY = 0.14
const RING_START = 0.35
const REVEAL_DONE = RING_START + RATIOS.length * RING_DELAY + 0.9

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t } = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const [leaving, setLeaving] = useState(false)

  const dismiss = () => {
    if (leaving) return
    setLeaving(true)
    // Fire and forget: opening the context is the whole point of the gesture,
    // but a failure here must not block entry to the app.
    void engine.start().catch(() => {})
    setTimeout(onDone, 560)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    const started = performance.now()

    const resize = () => {
      // Cap at 3x: beyond that the extra pixels cost fill rate and buy nothing
      // a display can actually resolve.
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const size = Math.min(wrap.clientWidth, wrap.clientHeight)
      canvas.width = Math.round(size * dpr)
      canvas.height = Math.round(size * dpr)
      canvas.style.width = `${size}px`
      canvas.style.height = `${size}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    // Read the live accent so the rings agree with the button and with whatever
    // frequency the app is tuned to, rather than sitting on a fixed brand hue.
    const hueOf = () =>
      Number(getComputedStyle(document.documentElement).getPropertyValue('--h').trim()) || 265
    // Light theme needs the inverse treatment: strokes go darker and the glow
    // comes down, because a 74%-lightness line on a near-white ground is close
    // to invisible.
    const isLight = () => document.documentElement.classList.contains('theme-light')

    const draw = () => {
      raf = requestAnimationFrame(draw)
      // Reduced motion still composes the final frame, it just does not travel.
      const t = reducedMotion ? REVEAL_DONE : (performance.now() - started) / 1000

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2 - 6

      ctx.clearRect(0, 0, w, h)
      ctx.lineCap = 'round'

      const H = hueOf()
      const light = isLight()
      const strokeL = light ? 46 : 74
      const glowStrength = light ? 0.35 : 1

      // ---- Bloom behind everything -------------------------------------
      const bloomIn = clamp01(t / 1.2)
      const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      bloom.addColorStop(0, `hsla(${H + 25}, ${light ? 85 : 100}%, ${light ? 62 : 72}%, ${(light ? 0.22 : 0.3) * bloomIn})`)
      bloom.addColorStop(0.4, `hsla(${H}, 95%, 60%, ${(light ? 0.09 : 0.12) * bloomIn})`)
      bloom.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = bloom
      ctx.fillRect(0, 0, w, h)

      // ---- Harmonic rings ------------------------------------------------
      RATIOS.forEach((ratio, i) => {
        const appear = RING_START + i * RING_DELAY
        const local = clamp01((t - appear) / 1.1)
        if (local <= 0) return

        // Radius is the ratio itself, normalised to the canvas.
        const target = R * (ratio / MAX_RATIO) * 0.92
        const radius = target * easeOutExpo(local)
        const hue = H + i * 15
        const settle = 0.22 + 0.5 * local

        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue}, 95%, ${strokeL}%, ${settle * (light ? 0.9 : 0.55)})`
        ctx.lineWidth = light ? 1.4 : 1.1
        ctx.shadowBlur = 16 * glowStrength
        ctx.shadowColor = `hsla(${hue}, 100%, 68%, ${0.75 * glowStrength})`
        ctx.stroke()
        ctx.shadowBlur = 0

        // Satellite: angular speed IS the ratio, so the whole figure drifts and
        // realigns on the period of the scale.
        const angle = t * ratio * 0.62 - Math.PI / 2
        const px = cx + Math.cos(angle) * radius
        const py = cy + Math.sin(angle) * radius

        // Filament back to the root.
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(px, py)
        ctx.strokeStyle = `hsla(${hue}, 95%, ${light ? 50 : 78}%, ${local * (light ? 0.16 : 0.1)})`
        ctx.lineWidth = 0.7
        ctx.stroke()

        const dotR = 2.2 + local * 1.4
        ctx.beginPath()
        ctx.arc(px, py, dotR, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue}, ${light ? 80 : 100}%, ${light ? 48 : 86}%, ${local})`
        ctx.shadowBlur = 18 * glowStrength
        ctx.shadowColor = `hsla(${hue}, 100%, 72%, ${0.9 * glowStrength})`
        ctx.fill()
        ctx.shadowBlur = 0
      })

      // ---- The root itself, last so it sits on top ------------------------
      const corePop = easeOutExpo(clamp01(t / 0.5))
      const breathe = reducedMotion ? 1 : 1 + Math.sin(t * 1.7) * 0.05
      const coreR = R * 0.085 * corePop * breathe

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3.2)
      // A white core vanishes on a white ground, so light mode saturates it.
      core.addColorStop(0, light ? `hsla(${H + 20}, 90%, 46%, 0.98)` : 'hsla(0,0%,100%,0.98)')
      core.addColorStop(0.22, `hsla(${H + 30}, ${light ? 85 : 100}%, ${light ? 55 : 84}%, 0.85)`)
      core.addColorStop(1, `hsla(${H}, 95%, 60%, 0)`)
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, coreR * 3.2, 0, Math.PI * 2)
      ctx.fill()
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [reducedMotion])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('splash.aria')}
      onClick={dismiss}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center px-6"
      style={{
        background: 'var(--bg-deep)',
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'scale(1.04)' : 'scale(1)',
        transition: 'opacity 520ms cubic-bezier(0.4,0,0.2,1), transform 520ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div ref={wrapRef} className="grid aspect-square w-full max-w-[min(76vw,340px)] place-items-center">
        <canvas ref={canvasRef} aria-hidden />
      </div>

      <div className="mt-8 text-center">
        <h1
          className="glow-text text-5xl font-bold sm:text-6xl"
          style={{
            animation: reducedMotion ? undefined : 'splash-title 1100ms cubic-bezier(0.16,1,0.3,1) 700ms both',
          }}
        >
          Resona
        </h1>
        <p
          className="txt-2 mx-auto mt-3 max-w-xs text-sm leading-relaxed"
          style={{
            animation: reducedMotion ? undefined : 'fade-up 900ms cubic-bezier(0.16,1,0.3,1) 1150ms both',
          }}
        >
          {t('splash.tagline')}
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          dismiss()
        }}
        className="btn btn-primary mt-9 w-full max-w-[240px]"
        style={{
          animation: reducedMotion ? undefined : 'fade-up 800ms cubic-bezier(0.16,1,0.3,1) 1500ms both',
        }}
      >
        {t('splash.start')}
      </button>

      <p
        className="txt-3 mt-4 text-[11px]"
        style={{ animation: reducedMotion ? undefined : 'fade-up 800ms ease 1900ms both' }}
      >
        {t('splash.tapAnywhere')}
      </p>
    </div>
  )
}
