import * as Tone from 'tone'

/**
 * Owns the single AudioContext, the master output chain and the analyser that
 * feeds the visualiser. Browsers block audio until a user gesture, so nothing
 * here touches the context until `start()` is called from a click/tap.
 */
/**
 * Makeup applied after the master slider, per melody engine.
 *
 * One number cannot serve all of them, which measurement is what showed: with
 * the slider at maximum a techno session peaks around -4.6dBFS and an ambient
 * one around -15.8dBFS, so a single gain either leaves the quiet engine twelve
 * decibels down or drives the loud one into the ceiling. Each figure here brings
 * its own engine's measured worst peak to about -3dBFS — close enough to full
 * scale to use the converter properly, far enough that the limiter stays a
 * safety net rather than part of the sound.
 *
 * Re-measure with `scratchpad/audio-probe` if an engine's voicing changes.
 */
/**
 * Makeup per engine, matched on RMS — which is the correction, because the
 * first version of this table was matched on peak.
 *
 * Peak is the wrong meter for this app. The club engines are transient music:
 * a kick puts a tall spike on an otherwise quiet signal, so a high crest factor
 * makes their peak run far ahead of their loudness. The ambient engine is the
 * opposite — a sustained drone sits close to its own peak. Levelling the two on
 * peak therefore levelled the wrong thing: measured across all five engines on
 * the default session, ambient came out at -14.5dBFS RMS against about -21 for
 * every club style. Seven decibels louder, from a table written to make them
 * equal.
 *
 * Seven decibels of sustained low-frequency energy is not a small error. It is
 * loud on its own, and loud low end masks high end far harder than the reverse,
 * which is why the rain and the wind had all but vanished underneath it.
 *
 * These are now set so every engine lands near -20dBFS RMS with peaks around
 * -10, which leaves the limiter as the safety net it is meant to be rather than
 * something the mix leans on.
 */
const OUTPUT_TRIM: Record<string, number> = {
  ambient: 2.1,
  techno: 1.2,
  trance: 1.2,
  psytrance: 1.2,
  deephouse: 1.2,
}
const DEFAULT_TRIM = 1.2

class ToneEngine {
  private started = false
  private masterGain: Tone.Gain | null = null
  private makeup: Tone.Gain | null = null
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
    /**
     * Output staging, and the reason it exists.
     *
     * The user's master slider is 0 to 1 and was written straight into the gain
     * feeding the limiter, so the whole chain was capped at unity — and with the
     * layer gains and the synths' own volumes stacked under that, measurement
     * put a real session's peak at -13.7dBFS for ambient and -7.2dBFS for techno,
     * with the limiter never once engaging. Thirteen decibels of headroom sat
     * unused.
     *
     * That is not merely quiet, it is quieter than it should sound: the listener
     * makes the difference up on the phone's own amplifier, which lifts the
     * converter's noise floor by exactly as much, and a Bluetooth or AirPlay
     * codec allocates its bits against full scale rather than against the signal.
     * Both cost real quality, and neither is recovered by turning something up.
     *
     * So a fixed makeup stage sits between the slider and the limiter, sized by
     * measurement rather than by ear: enough that the loudest material this app
     * makes peaks near -2dBFS with the slider at maximum, and no more. Nothing is
     * compressed to get there — the 16.7dB crest factor of a techno session is
     * the same before and after. The limiter stays a safety net that does not
     * normally engage, which is verified rather than assumed.
     */
    this.makeup = new Tone.Gain(DEFAULT_TRIM).connect(this.limiter)
    this.masterGain = new Tone.Gain(0.9).connect(this.makeup)

    // 1024 bins puts a bin every ~21 Hz at 44.1 kHz, which is fine enough to
    // separate the scale's intervals — 528 and its 9/8 are 66 Hz apart. The old
    // 128 bins were 172 Hz wide and could not tell one harmonic from another.
    this.analyserNode = new Tone.Analyser('fft', 1024)
    this.analyserNode.smoothing = 0.72
    this.waveformNode = new Tone.Analyser('waveform', 512)
    this.masterGain.connect(this.analyserNode)
    this.masterGain.connect(this.waveformNode)

    const transport = Tone.getTransport()
    transport.bpm.value = 60
    transport.start()

    this.started = true

    /**
     * A handle on the live graph, in development only.
     *
     * Everything else in this app is checked by measuring it, and the audio was
     * the one part that could only be checked by ear — the nodes are module
     * private, so a test had no way to ask what the limiter was doing or how
     * much headroom was left. This is how those numbers get out. Guarded by
     * `import.meta.env.DEV`, so it is not in the shipped bundle at all.
     */
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__audio = {
        context: Tone.getContext(),
        master: this.masterGain,
        makeup: this.makeup,
        limiter: this.limiter,
        Tone,
      }
    }
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

  /** Needed to turn an FFT bin index back into a frequency. */
  get sampleRate() {
    return Tone.getContext().sampleRate
  }

  get now() {
    return Tone.now()
  }

  /**
   * Sets the makeup for the engine now playing. Ramped over a second: a style
   * change is already a musical event, and a step in level on top of it reads as
   * a fault rather than as a transition.
   */
  setOutputTrim(style: string, ramp = 1) {
    this.makeup?.gain.rampTo(OUTPUT_TRIM[style] ?? DEFAULT_TRIM, ramp)
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
