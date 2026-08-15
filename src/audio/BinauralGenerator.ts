import { Tone } from './ToneEngine'
import { carrierFor } from './scale'
import type { BeatMode } from '../lib/types'

/**
 * Brainwave layer (§4.2).
 *
 * Two rendering modes are built in parallel and crossfaded, so the user can
 * switch mid-session without a gap:
 *
 *  - `binaural`  — two oscillators `beatHz` apart, panned hard left/right. The
 *                  beat only exists inside the listener's head, so this mode
 *                  genuinely requires headphones.
 *  - `isochronic`— a single centred carrier whose amplitude is pulsed at
 *                  `beatHz`. Works on speakers, which is why it is the default.
 *
 * The pulse uses a sine-shaped gate rather than a hard square: a square edge at
 * these amplitudes produces an audible click on every pulse, which defeats the
 * point of a relaxation tool.
 */
export class BinauralGenerator {
  private out: Tone.Gain
  private tone: Tone.Filter

  private binauralGain: Tone.Gain
  private oscL: Tone.Oscillator
  private oscR: Tone.Oscillator
  private panL: Tone.Panner
  private panR: Tone.Panner

  private isoGain: Tone.Gain
  private isoOsc: Tone.Oscillator
  private isoPulse: Tone.Gain
  private isoLfo: Tone.LFO

  private carrier = 200
  private beatHz = 6
  private mode: BeatMode = 'isochronic'
  private running = false

  constructor(destination: Tone.InputNode) {
    this.out = new Tone.Gain(1).connect(destination)
    // Sine carriers are already pure; the filter just takes the edge off the
    // very top for long listening sessions.
    this.tone = new Tone.Filter({ type: 'lowpass', frequency: 3000, rolloff: -12 }).connect(this.out)

    this.binauralGain = new Tone.Gain(0).connect(this.tone)
    this.panL = new Tone.Panner(-1).connect(this.binauralGain)
    this.panR = new Tone.Panner(1).connect(this.binauralGain)
    this.oscL = new Tone.Oscillator({ frequency: 200, type: 'sine', volume: -12 }).connect(this.panL)
    this.oscR = new Tone.Oscillator({ frequency: 206, type: 'sine', volume: -12 }).connect(this.panR)

    this.isoGain = new Tone.Gain(1).connect(this.tone)
    this.isoPulse = new Tone.Gain(0.5).connect(this.isoGain)
    this.isoOsc = new Tone.Oscillator({ frequency: 200, type: 'sine', volume: -12 }).connect(
      this.isoPulse,
    )
    this.isoLfo = new Tone.LFO({ frequency: 6, min: 0, max: 1, type: 'sine' })
    this.isoLfo.connect(this.isoPulse.gain)
  }

  /** Ties the carrier to the musical root so the two layers stay consonant. */
  setRoot(rootHz: number) {
    this.carrier = carrierFor(rootHz)
    this.applyFrequencies(0.8)
  }

  setBeatHz(hz: number) {
    this.beatHz = Math.max(0.5, Math.min(50, hz))
    this.applyFrequencies(0.4)
    this.isoLfo.frequency.rampTo(this.beatHz, 0.4)
  }

  setMode(mode: BeatMode) {
    this.mode = mode
    const ramp = 0.6
    this.binauralGain.gain.rampTo(mode === 'binaural' ? 1 : 0, ramp)
    this.isoGain.gain.rampTo(mode === 'isochronic' ? 1 : 0, ramp)
  }

  getMode() {
    return this.mode
  }

  getCarrier() {
    return this.carrier
  }

  private applyFrequencies(ramp: number) {
    // Split the beat symmetrically around the carrier so neither ear is asked
    // to hold the "odd" pitch.
    const half = this.beatHz / 2
    this.oscL.frequency.rampTo(this.carrier - half, ramp)
    this.oscR.frequency.rampTo(this.carrier + half, ramp)
    this.isoOsc.frequency.rampTo(this.carrier, ramp)
  }

  start() {
    if (this.running) return
    this.running = true
    this.oscL.start()
    this.oscR.start()
    this.isoOsc.start()
    this.isoLfo.start()
    this.setMode(this.mode)
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.oscL.stop()
    this.oscR.stop()
    this.isoOsc.stop()
    this.isoLfo.stop()
  }

  dispose() {
    this.stop()
    this.isoLfo.dispose()
    this.isoOsc.dispose()
    this.isoPulse.dispose()
    this.isoGain.dispose()
    this.oscL.dispose()
    this.oscR.dispose()
    this.panL.dispose()
    this.panR.dispose()
    this.binauralGain.dispose()
    this.tone.dispose()
    this.out.dispose()
  }
}
