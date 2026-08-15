import { Tone, engine } from './ToneEngine'
import { SCALES, carrierFor, nextDegree, playableScale, scaleForRoot } from './scale'

/**
 * The generative ambient layer (§4.3).
 *
 * Three voices, all tuned from the same root:
 *   1. a drone sitting on the exact target frequency (folded to a low octave),
 *      so the frequency itself is continuously present as the tonal centre;
 *   2. a slow pad that voices consonant intervals of the root;
 *   3. a sparse lead that walks the just-intonation scale via a Markov chain.
 *
 * Nothing loops. The Transport keeps running and notes are scheduled with
 * varying probability, register and length, so the piece is theoretically
 * endless and never repeats a bar.
 */
export class GenerativeMelody {
  private out: Tone.Gain
  private reverb: Tone.Reverb
  private delay: Tone.FeedbackDelay
  private filter: Tone.Filter
  private filterLfo: Tone.LFO
  private chorus: Tone.Chorus

  private lead: Tone.PolySynth<Tone.Synth>
  private pad: Tone.PolySynth<Tone.Synth>
  private drone: Tone.Oscillator
  private droneSub: Tone.Oscillator
  private droneGain: Tone.Gain
  private droneTremolo: Tone.LFO

  private scale: number[] = []
  private degree = 0
  private root = 528
  private density = 0.5
  private leadEvent: number | null = null
  private padEvent: number | null = null
  private running = false

  constructor(destination: Tone.InputNode) {
    this.out = new Tone.Gain(1).connect(destination)

    this.reverb = new Tone.Reverb({ decay: 9, preDelay: 0.06, wet: 0.55 }).connect(this.out)
    this.delay = new Tone.FeedbackDelay({ delayTime: 0.75, feedback: 0.42, wet: 0.26 }).connect(
      this.reverb,
    )
    this.chorus = new Tone.Chorus({ frequency: 0.15, delayTime: 6, depth: 0.5, wet: 0.35 })
      .connect(this.delay)
      .start()
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 1200, rolloff: -24, Q: 0.6 }).connect(
      this.chorus,
    )

    // A very slow cutoff drift keeps the timbre alive over long sessions.
    this.filterLfo = new Tone.LFO({ frequency: 0.021, min: 620, max: 2100 })
    this.filterLfo.connect(this.filter.frequency)
    this.filterLfo.start()

    this.lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 1.6, decay: 2.4, sustain: 0.35, release: 7 },
      volume: -15,
    }).connect(this.filter)
    this.lead.maxPolyphony = 12

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 5, decay: 3, sustain: 0.6, release: 12 },
      volume: -20,
    }).connect(this.filter)
    this.pad.maxPolyphony = 10

    // The drone is deliberately routed with less wet signal — it should read as
    // a steady anchor, not as another washy voice.
    this.droneGain = new Tone.Gain(0.24).connect(this.reverb)
    this.drone = new Tone.Oscillator({ frequency: 528, type: 'sine', volume: -8 }).connect(
      this.droneGain,
    )
    this.droneSub = new Tone.Oscillator({ frequency: 264, type: 'sine', volume: -14 }).connect(
      this.droneGain,
    )
    this.droneTremolo = new Tone.LFO({ frequency: 0.06, min: 0.16, max: 0.3 })
    this.droneTremolo.connect(this.droneGain.gain)
    this.droneTremolo.start()
  }

  /** Retunes every voice to a new root without stopping playback. */
  setRoot(rootHz: number) {
    this.root = rootHz
    const scaleName = scaleForRoot(rootHz)
    this.scale = playableScale(rootHz, SCALES[scaleName])
    this.degree = Math.floor(this.scale.length / 2)

    const droneHz = carrierFor(rootHz)
    const ramp = engine.now + 1.5
    this.drone.frequency.rampTo(droneHz, 1.5)
    this.droneSub.frequency.rampTo(droneHz / 2, 1.5)
    void ramp
  }

  setDensity(value: number) {
    this.density = Math.max(0, Math.min(1, value))
  }

  start() {
    if (this.running) return
    this.running = true
    if (!this.scale.length) this.setRoot(this.root)

    this.drone.start()
    this.droneSub.start()

    const transport = engine.transport

    // Lead voice: dense-ish grid, sparse probability. Each hit re-rolls its own
    // length, velocity and octave, so the texture never settles into a pattern.
    this.leadEvent = transport.scheduleRepeat((time) => {
      const chance = 0.14 + this.density * 0.4
      if (Math.random() > chance) return
      this.degree = nextDegree(this.degree, this.scale.length)
      const freq = this.scale[this.degree]
      const dur = 2 + Math.random() * 6
      const vel = 0.2 + Math.random() * 0.35
      this.lead.triggerAttackRelease(freq, dur, time, vel)

      // Occasionally shadow the note a fifth or octave up for a shimmer.
      if (Math.random() < 0.22) {
        const partner = Math.random() < 0.5 ? freq * 1.5 : freq * 2
        if (partner < 2400) {
          this.lead.triggerAttackRelease(partner, dur * 0.7, time + 0.35, vel * 0.5)
        }
      }
    }, 1.5)

    // Pad voice: slow consonant clusters built from the root's harmonic series.
    this.padEvent = transport.scheduleRepeat((time) => {
      if (Math.random() > 0.45) return
      const base = this.scale[Math.floor(Math.random() * this.scale.length)]
      const voicing = [1, 3 / 2, 2][Math.floor(Math.random() * 3)]
      const notes = [base, base * voicing].filter((f) => f > 80 && f < 2000)
      this.pad.triggerAttackRelease(notes, 14 + Math.random() * 10, time, 0.16)
    }, 11)
  }

  stop() {
    if (!this.running) return
    this.running = false
    const transport = engine.transport
    if (this.leadEvent !== null) transport.clear(this.leadEvent)
    if (this.padEvent !== null) transport.clear(this.padEvent)
    this.leadEvent = null
    this.padEvent = null
    this.lead.releaseAll()
    this.pad.releaseAll()
    this.drone.stop()
    this.droneSub.stop()
  }

  dispose() {
    this.stop()
    this.filterLfo.dispose()
    this.droneTremolo.dispose()
    this.lead.dispose()
    this.pad.dispose()
    this.drone.dispose()
    this.droneSub.dispose()
    this.droneGain.dispose()
    this.filter.dispose()
    this.chorus.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.out.dispose()
  }
}
