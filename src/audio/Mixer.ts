import { Tone, engine } from './ToneEngine'

export type LayerName = 'melody' | 'beat' | 'ambience'

/**
 * One Gain node per layer, all summing into the engine master (§4.5). The UI
 * writes straight into these in real time; every change is ramped so a slider
 * drag never produces a zipper click.
 */
export class Mixer {
  private gains: Record<LayerName, Tone.Gain>
  private targets: Record<LayerName, number> = { melody: 0.7, beat: 0.35, ambience: 0.4 }
  /** Global multiplier used by the timer fade-out, independent of user levels. */
  private fade = 1

  constructor() {
    this.gains = {
      melody: new Tone.Gain(0).connect(engine.master),
      beat: new Tone.Gain(0).connect(engine.master),
      ambience: new Tone.Gain(0).connect(engine.master),
    }
  }

  input(layer: LayerName): Tone.Gain {
    return this.gains[layer]
  }

  setLevel(layer: LayerName, value: number, ramp = 0.12) {
    this.targets[layer] = Math.max(0, Math.min(1, value))
    this.gains[layer].gain.rampTo(this.targets[layer] * this.fade, ramp)
  }

  getLevel(layer: LayerName) {
    return this.targets[layer]
  }

  /** Applies a 0-1 multiplier across every layer — used for fades. */
  setFade(value: number, ramp: number) {
    this.fade = Math.max(0, Math.min(1, value))
    for (const layer of Object.keys(this.gains) as LayerName[]) {
      this.gains[layer].gain.rampTo(this.targets[layer] * this.fade, ramp)
    }
  }

  fadeIn(seconds = 4) {
    this.setFade(1, seconds)
  }

  fadeOut(seconds = 15) {
    this.setFade(0, seconds)
  }

  dispose() {
    for (const g of Object.values(this.gains)) g.dispose()
  }
}
