import { Tone } from './ToneEngine'
import type { AmbienceId } from '../lib/types'

/**
 * Environment layer (§4.4).
 *
 * The built-in textures are synthesised from filtered noise rather than shipped
 * as audio files. That keeps the install tiny, removes any sample-licensing
 * question, guarantees a genuinely seamless loop (there is no loop point at
 * all), and means the layer works offline from the very first launch.
 *
 * Files are still supported: anything listed in
 * `public/audio/ambience/manifest.json` is loaded with `Tone.Player`
 * (`loop: true` plus fades) and appears next to the synthesised options.
 */

export type AmbienceOption = { id: AmbienceId; label: string; kind: 'synth' | 'file'; url?: string }

export const BUILTIN_AMBIENCE: AmbienceOption[] = [
  { id: 'none', label: 'ללא', kind: 'synth' },
  { id: 'rain', label: 'גשם', kind: 'synth' },
  { id: 'ocean', label: 'ים', kind: 'synth' },
  { id: 'wind', label: 'רוח', kind: 'synth' },
  { id: 'brown', label: 'רעש חום', kind: 'synth' },
  { id: 'pink', label: 'רעש ורוד', kind: 'synth' },
  { id: 'white', label: 'רעש לבן', kind: 'synth' },
]

type Voice = { nodes: { dispose: () => void }[]; start: () => void }

export class Ambience {
  private out: Tone.Gain
  private voice: Voice | null = null
  private current: AmbienceId = 'none'
  private extra: AmbienceOption[] = []
  private running = false

  constructor(destination: Tone.InputNode) {
    this.out = new Tone.Gain(1).connect(destination)
  }

  /** Merges any user-supplied files into the option list. Called once at boot. */
  async loadManifest(): Promise<AmbienceOption[]> {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}audio/ambience/manifest.json`)
      if (!res.ok) return this.options()
      const items = (await res.json()) as { id: string; label: string; file: string }[]
      this.extra = items.map((i) => ({
        id: i.id,
        label: i.label,
        kind: 'file' as const,
        url: `${import.meta.env.BASE_URL}audio/ambience/${i.file}`,
      }))
    } catch {
      // No manifest, or offline before it was cached — the synthesised set is
      // fully functional on its own.
      this.extra = []
    }
    return this.options()
  }

  options(): AmbienceOption[] {
    return [...BUILTIN_AMBIENCE, ...this.extra]
  }

  getCurrent() {
    return this.current
  }

  set(id: AmbienceId) {
    if (id === this.current) return
    this.current = id
    this.rebuild()
  }

  start() {
    this.running = true
    this.rebuild()
  }

  stop() {
    this.running = false
    this.teardown()
  }

  private teardown() {
    if (!this.voice) return
    for (const n of this.voice.nodes) {
      try {
        n.dispose()
      } catch {
        /* already disposed */
      }
    }
    this.voice = null
  }

  private rebuild() {
    this.teardown()
    if (!this.running || this.current === 'none') return
    const file = this.extra.find((o) => o.id === this.current)
    this.voice = file?.url ? this.buildFile(file.url) : this.buildSynth(this.current)
    this.voice?.start()
  }

  private buildFile(url: string): Voice {
    const player = new Tone.Player({
      url,
      loop: true,
      autostart: false,
      fadeIn: 3,
      fadeOut: 3,
      volume: -6,
    }).connect(this.out)
    return {
      nodes: [player],
      start: () => {
        // `loaded` resolves immediately if the buffer was already cached.
        void player.load(url).then(() => {
          if (!player.disposed) player.start()
        })
      },
    }
  }

  private buildSynth(id: AmbienceId): Voice {
    switch (id) {
      case 'rain':
        return this.buildRain()
      case 'ocean':
        return this.buildOcean()
      case 'wind':
        return this.buildWind()
      case 'white':
        return this.buildNoise('white', 6500, -22)
      case 'pink':
        return this.buildNoise('pink', 9000, -16)
      case 'brown':
        return this.buildNoise('brown', 9000, -8)
      default:
        return { nodes: [], start: () => {} }
    }
  }

  /** Hiss plus a low rumble, with a slow shower-intensity drift. */
  private buildRain(): Voice {
    const hissFilter = new Tone.Filter({ type: 'highpass', frequency: 800, rolloff: -12 })
    const tame = new Tone.Filter({ type: 'lowpass', frequency: 7000, rolloff: -12 }).connect(this.out)
    hissFilter.connect(tame)
    const hiss = new Tone.Noise({ type: 'white', volume: -20 }).connect(hissFilter)

    const rumbleFilter = new Tone.Filter({ type: 'lowpass', frequency: 380, rolloff: -24 }).connect(
      this.out,
    )
    const rumble = new Tone.Noise({ type: 'brown', volume: -14 }).connect(rumbleFilter)

    const drift = new Tone.LFO({ frequency: 0.023, min: 600, max: 1400 })
    drift.connect(hissFilter.frequency)

    return {
      nodes: [hiss, rumble, hissFilter, tame, rumbleFilter, drift],
      start: () => {
        hiss.start()
        rumble.start()
        drift.start()
      },
    }
  }

  /** Brown noise swept by two out-of-phase LFOs, which reads as breaking waves. */
  private buildOcean(): Voice {
    const swell = new Tone.Gain(0.5).connect(this.out)
    const filter = new Tone.Filter({ type: 'lowpass', frequency: 500, rolloff: -24, Q: 1.2 }).connect(
      swell,
    )
    const noise = new Tone.Noise({ type: 'brown', volume: -4 }).connect(filter)

    const wave = new Tone.LFO({ frequency: 0.075, min: 0.12, max: 0.85, type: 'sine' })
    wave.connect(swell.gain)
    const sweep = new Tone.LFO({ frequency: 0.062, min: 220, max: 1100, type: 'sine' })
    sweep.connect(filter.frequency)

    return {
      nodes: [noise, filter, swell, wave, sweep],
      start: () => {
        noise.start()
        wave.start()
        sweep.start()
      },
    }
  }

  /** Pink noise through a wandering band-pass — gusts without any loop point. */
  private buildWind(): Voice {
    const level = new Tone.Gain(0.6).connect(this.out)
    const band = new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 1.8 }).connect(level)
    const noise = new Tone.Noise({ type: 'pink', volume: -8 }).connect(band)

    const gust = new Tone.LFO({ frequency: 0.041, min: 280, max: 1500, type: 'sine' })
    gust.connect(band.frequency)
    const breath = new Tone.LFO({ frequency: 0.033, min: 0.2, max: 0.9, type: 'triangle' })
    breath.connect(level.gain)

    return {
      nodes: [noise, band, level, gust, breath],
      start: () => {
        noise.start()
        gust.start()
        breath.start()
      },
    }
  }

  private buildNoise(type: 'white' | 'pink' | 'brown', cutoff: number, volume: number): Voice {
    const filter = new Tone.Filter({ type: 'lowpass', frequency: cutoff, rolloff: -12 }).connect(
      this.out,
    )
    const noise = new Tone.Noise({ type, volume }).connect(filter)
    return { nodes: [noise, filter], start: () => noise.start() }
  }

  dispose() {
    this.teardown()
    this.out.dispose()
  }
}
