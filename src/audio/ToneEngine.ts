import * as Tone from 'tone'

/**
 * Owns the single AudioContext, the master output chain and the analyser that
 * feeds the visualiser. Browsers block audio until a user gesture, so nothing
 * here touches the context until `start()` is called from a click/tap.
 */
class ToneEngine {
  private started = false
  private masterGain: Tone.Gain | null = null
  private limiter: Tone.Limiter | null = null
  private analyserNode: Tone.Analyser | null = null
  private waveformNode: Tone.Analyser | null = null

  get isStarted() {
    return this.started
  }

  /** Must be called from inside a user-gesture handler. Idempotent. */
  async start(): Promise<void> {
    if (this.started) {
      // The context can still be suspended after a tab switch or an OS interrupt.
      if (Tone.getContext().state !== 'running') await Tone.start()
      return
    }

    await Tone.start()
    // A slightly larger look-ahead keeps the generative scheduler seam-free on
    // mobile, where the main thread stalls more often.
    Tone.getContext().lookAhead = 0.2

    this.limiter = new Tone.Limiter(-1).toDestination()
    this.masterGain = new Tone.Gain(0.9).connect(this.limiter)

    this.analyserNode = new Tone.Analyser('fft', 128)
    this.analyserNode.smoothing = 0.82
    this.waveformNode = new Tone.Analyser('waveform', 512)
    this.masterGain.connect(this.analyserNode)
    this.masterGain.connect(this.waveformNode)

    const transport = Tone.getTransport()
    transport.bpm.value = 60
    transport.start()

    this.started = true
  }

  get master(): Tone.Gain {
    if (!this.masterGain) throw new Error('ToneEngine.start() must run first')
    return this.masterGain
  }

  /**
   * The last node before the speakers. Exposed so the output can be re-routed
   * to a MediaStream for AirPlay without the mixer knowing about it.
   */
  get output(): Tone.Limiter {
    if (!this.limiter) throw new Error('ToneEngine.start() must run first')
    return this.limiter
  }

  get analyser(): Tone.Analyser | null {
    return this.analyserNode
  }

  get waveform(): Tone.Analyser | null {
    return this.waveformNode
  }

  get transport() {
    return Tone.getTransport()
  }

  get now() {
    return Tone.now()
  }

  setMasterVolume(value: number, ramp = 0.15) {
    this.masterGain?.gain.rampTo(Math.max(0, Math.min(1, value)), ramp)
  }

  /** Frequency-domain magnitudes in dB, or null before the engine starts. */
  getSpectrum(): Float32Array | null {
    const v = this.analyserNode?.getValue()
    return v instanceof Float32Array ? v : null
  }

  getWaveform(): Float32Array | null {
    const v = this.waveformNode?.getValue()
    return v instanceof Float32Array ? v : null
  }
}

export const engine = new ToneEngine()
export { Tone }
