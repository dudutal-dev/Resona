import { useEffect, useRef } from 'react'
import { engine } from '../audio/ToneEngine'
import { BAND_COUNT, MAX_RATIO, RATIOS, readBands } from '../audio/harmonics'
import { getFrequency } from '../lib/catalog'
import { useSession } from '../store/sessionStore'
import { useSettings } from '../store/settingsStore'

/**
 * The figure, whole, moved by the sound.
 *
 * The artwork is drawn as itself — every pixel of it, at the resolution it was
 * made — and everything here is about making that picture live without taking it
 * apart. An earlier version reduced it to forty thousand points and redrew those
 * each frame, which moved beautifully and threw away exactly what made the
 * artwork worth using: its detail. This keeps the detail and finds the movement
 * elsewhere.
 *
 * Three things move it, and one of them is the whole idea:
 *
 *   1. It breathes. A slow scale on the overall level, so the body swells as it
 *      plays.
 *   2. It lights along its height. The artwork's colour runs from red at the feet
 *      through the spectrum to violet at the crown, which is the order of the
 *      intervals of the just scale — so height stands for interval. A copy of the
 *      figure is masked by a vertical gradient whose stops are the seven band
 *      levels and added back over itself: play a fifth, and the fifth's height is
 *      the part of the body that glows. It glows in the artwork's own colours,
 *      because only the mask's alpha is ever touched. Nothing is assigned
 *      arbitrarily — the picture already knew which height held which interval.
 *   3. The sound bends it. The figure is drawn as a stack of horizontal strips,
 *      each shifted sideways by the waveform read at its own height: the sound as
 *      a standing wave on a body. It is the same picture, sheared, not a
 *      reconstruction of it — at rest every offset is zero and the strips lie
 *      back down into the original image exactly.
 *
 * Around it: dust that brightens on its interval, ellipses crossing the frame
 * with a satellite on each, and a ring thrown from the height of any band that
 * jumps. A standing person in a 16:9 frame leaves a lot of empty picture.
 */

type Props = {
  /** The artwork to draw. The stage picks it; this only draws it. */
  src: string
  playing: boolean
  /** Drives satellite and dust size — a television is looked at from further. */
  scale?: number
  className?: string
}

/**
 * Horizontal strips the figure is drawn in. Ninety-six is fine enough that the
 * shear reads as a curve rather than as steps, and few enough that the whole
 * stack is a small part of a frame.
 */
const STRIPS = 96
/** How far the waveform may push a strip, as a fraction of the figure's width. */
const SWAY = 0.02

/**
 * Dust across the whole frame, in fractions of it. Each mote is assigned an
 * interval and brightens on it, so the air around the figure carries the harmony
 * too. Generated from a fixed sequence rather than `Math.random`, so the sky is
 * the same every time the stage is opened.
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

export function FigureField({ src, playing, scale = 1, className = '' }: Props) {
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

    /**
     * Two working canvases. `posed` holds the figure with this frame's shear
     * applied, so the glow pass can reuse it instead of laying out all the strips
     * again; `glow` holds a copy of that, masked down to the heights the harmony
     * is sounding at.
     */
    const posed = document.createElement('canvas')
    const pctx = posed.getContext('2d')
    const glow = document.createElement('canvas')
    const gctx = glow.getContext('2d')
    /**
     * The artwork at 24 pixels wide, which is the whole trick behind the wash
     * that fills the sides of the frame: drawn back out across the full width it
     * is a heavy blur that the browser interpolates for free, in the artwork's
     * own colours. No filter, no second pass, and it works in every browser
     * rather than in the ones with `ctx.filter`.
     */
    const ambient = document.createElement('canvas')
    const actx = ambient.getContext('2d')
    if (!pctx || !gctx || !actx) return

    const image = new Image()
    let ready = false
    image.decoding = 'async'
    image.src = src
    void image
      .decode()
      .then(() => {
        ambient.width = 24
        ambient.height = Math.max(1, Math.round((24 * image.naturalHeight) / image.naturalWidth))
        actx.drawImage(image, 0, 0, ambient.width, ambient.height)
        ready = true
      })
      .catch(() => {
        ready = false
      })

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

    const resize = () => {
      // Three, not two: sharpness is the point of drawing the artwork whole, and
      // on a phone or a 4K panel the extra device pixels are there.
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      w = wrap.clientWidth
      h = wrap.clientHeight
      if (!w || !h) return
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      for (const c of [posed, glow]) {
        c.width = canvas.width
        c.height = canvas.height
      }
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)

    const hueOf = () =>
      Number(getComputedStyle(document.documentElement).getPropertyValue('--h').trim()) || 265

    /** Where the figure sits in the frame this frame, after the breath. */
    let top = 0
    let extent = 0

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
      ctx.clearRect(0, 0, w, h)

      // ---- The wash --------------------------------------------------------
      // The artwork is a portrait panel and the stage is 16:9, so without this
      // it hangs in the middle of a black frame with a hard edge down each side.
      // Its own colours, blurred out to fill the picture, give the sides
      // something that belongs to it.
      if (ready && ambient.width) {
        const cover = Math.max(w / ambient.width, h / ambient.height)
        const cw = ambient.width * cover
        const chh = ambient.height * cover
        ctx.globalAlpha = 0.26 + energy * 0.14
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(ambient, (w - cw) / 2, (h - chh) / 2, cw, chh)
        ctx.globalAlpha = 1
        // Pulled down at the edges, so the wash stays behind the picture instead
        // of competing with the readouts sitting in the corners.
        const vignette = ctx.createRadialGradient(
          w / 2, h / 2, Math.min(w, h) * 0.25,
          w / 2, h / 2, Math.max(w, h) * 0.62,
        )
        vignette.addColorStop(0, 'rgba(0,0,0,0)')
        vignette.addColorStop(1, 'rgba(0,0,0,0.72)')
        ctx.fillStyle = vignette
        ctx.fillRect(0, 0, w, h)
      }

      ctx.globalCompositeOperation = 'lighter'

      // ---- Ground bloom ---------------------------------------------------
      const ground = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6)
      ground.addColorStop(0, `hsla(${H + 20}, 100%, 62%, ${0.05 + energy * 0.12})`)
      ground.addColorStop(1, 'hsla(0,0%,0%,0)')
      ctx.fillStyle = ground
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

      // ---- The figure ------------------------------------------------------
      if (ready && image.naturalHeight) {
        // Fitted to the height with a margin, and breathing on the level.
        const breath = 1 + energy * 0.035 + (reducedMotion ? 0 : Math.sin(t * 0.9) * 0.006)
        /**
         * Fitted inside the frame on both axes, not scaled to its height.
         *
         * Every figure was a tall portrait until one arrived at 16:9, and
         * height-fitting a landscape image makes it far wider than the screen —
         * on a phone held upright a 1280x720 artwork came out at three and a half
         * times the width of the frame, so all that showed was a slice of its
         * middle. Taking the smaller of the two ratios lets a portrait fill the
         * height as before and a landscape fill the width instead.
         */
        const fit = Math.min((h * 0.94) / image.naturalHeight, (w * 0.94) / image.naturalWidth)
        const dh = image.naturalHeight * fit * breath
        const dw = image.naturalWidth * fit * breath
        const dx = (w - dw) / 2
        const dy = (h - dh) / 2
        top = dy
        extent = dh

        pctx.clearRect(0, 0, w, h)
        const waveLen = wave?.length ?? 0
        const sliceH = image.naturalHeight / STRIPS
        const strip = dh / STRIPS
        for (let i = 0; i < STRIPS; i++) {
          // Strip 0 is the crown, so the interval is read from the bottom up.
          const fromFoot = 1 - i / STRIPS
          let offset = 0
          if (waveLen) {
            const band = Math.min(BAND_COUNT - 1, Math.floor(fromFoot * BAND_COUNT))
            const sample = wave![(fromFoot * waveLen) | 0] ?? 0
            offset = sample * dw * SWAY * (0.4 + bands[band] + impulse[band] * 0.8)
          }
          pctx.drawImage(
            image,
            0,
            i * sliceH,
            image.naturalWidth,
            sliceH,
            dx + offset,
            dy + i * strip,
            dw,
            // A shade over, so neighbouring strips overlap instead of showing
            // hairlines between them when the height does not divide evenly.
            strip + 1,
          )
        }

        /**
         * Feathered, then added rather than painted on.
         *
         * Both matter for the same reason. The artwork's own background is not
         * black — it is nebula — so a plain draw puts a visible rectangle in the
         * frame however well the figure inside it is lit. Adding it means black
         * contributes nothing and the panel dissolves into the wash; feathering
         * the last stretch of each edge takes care of what is left. Two
         * `destination-in` fills in a row multiply their alphas, which is how one
         * horizontal and one vertical gradient make a soft-edged frame.
         */
        pctx.globalCompositeOperation = 'destination-in'
        const across = pctx.createLinearGradient(dx, 0, dx + dw, 0)
        across.addColorStop(0, 'rgba(0,0,0,0)')
        across.addColorStop(0.24, 'rgba(0,0,0,1)')
        across.addColorStop(0.76, 'rgba(0,0,0,1)')
        across.addColorStop(1, 'rgba(0,0,0,0)')
        pctx.fillStyle = across
        pctx.fillRect(0, 0, w, h)
        const down = pctx.createLinearGradient(0, dy, 0, dy + dh)
        down.addColorStop(0, 'rgba(0,0,0,0)')
        down.addColorStop(0.07, 'rgba(0,0,0,1)')
        down.addColorStop(0.93, 'rgba(0,0,0,1)')
        down.addColorStop(1, 'rgba(0,0,0,0)')
        pctx.fillStyle = down
        pctx.fillRect(0, 0, w, h)
        pctx.globalCompositeOperation = 'source-over'

        ctx.globalCompositeOperation = 'lighter'
        ctx.drawImage(posed, 0, 0, w, h)

        // The harmony, as light along the body.
        gctx.clearRect(0, 0, w, h)
        gctx.globalCompositeOperation = 'source-over'
        gctx.drawImage(posed, 0, 0, w, h)
        const mask = gctx.createLinearGradient(0, dy, 0, dy + dh)
        for (let i = BAND_COUNT - 1; i >= 0; i--) {
          const level = Math.min(1, bands[i] * 1.1 + impulse[i] * 0.5)
          // Stop 0 is the crown; band 0 is the feet.
          mask.addColorStop(1 - (i + 0.5) / BAND_COUNT, `rgba(255,255,255,${level})`)
        }
        gctx.globalCompositeOperation = 'destination-in'
        gctx.fillStyle = mask
        gctx.fillRect(0, 0, w, h)

        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 0.85
        ctx.drawImage(glow, 0, 0, w, h)
        // Once more, larger and fainter: the same light, spilling off the body.
        const spill = 0.03 + energy * 0.03
        ctx.globalAlpha = 0.4
        ctx.drawImage(glow, -w * spill * 0.5, -h * spill * 0.5, w * (1 + spill), h * (1 + spill))
        ctx.globalAlpha = 1
      }

      // ---- Waves, out from the height of the band that struck --------------
      ctx.globalCompositeOperation = 'lighter'
      for (let i = waves.length - 1; i >= 0; i--) {
        const v = waves[i]
        v.r += h * 0.012
        v.life -= 0.016
        if (v.life <= 0 || v.r > Math.max(w, h)) {
          waves.splice(i, 1)
          continue
        }
        const shell = top + (1 - (v.band + 0.5) / BAND_COUNT) * extent
        ctx.beginPath()
        ctx.ellipse(w / 2, shell, v.r, v.r * 0.55, 0, 0, Math.PI * 2)
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
      const cx = w / 2
      const cy = h / 2
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
  }, [playing, reducedMotion, scale, src])

  return (
    // The caller may position this itself (the stage fills the screen with it);
    // combining its class with `relative` would apply two position values and
    // collapse the box to nothing.
    <div ref={wrapRef} className={className || 'relative'}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
