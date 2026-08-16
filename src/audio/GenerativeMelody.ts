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

  private pulse: Tone.Synth
  private pulseGain: Tone.Gain

  private scale: number[] = []
  private degree = 0
  private root = 528
  private density = 0.5
  /** 0 = drifting ambient, 1 = a steady pulse you could walk to. */
  private pace = 0.25
  private leadEvent: number | null = null
  private padEvent: number | null = null
  private pulseEvent: number | null = null
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

    // The pulse only exists to give a rhythmic session a floor to stand on. It
    // is routed dry — through the filter but past the delay — so repeats never
    // smear the beat into mush.
    this.pulseGain = new Tone.Gain(0).connect(this.reverb)
    this.pulse = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.004, decay: 0.22, sustain: 0, release: 0.18 },
      volume: -10,
    }).connect(this.pulseGain)
  }

  /**
   * Interval between possible lead notes. Everything rhythmic follows from
   * this one number: note lengths, attack and hit probability are all derived
   * from the same pace so the texture stays coherent instead of turning into
   * fast notes with slow envelopes.
   */
  private get leadInterval() {
    return 1.5 - this.pace * 1.12
  }

  setPace(value: number) {
    const next = Math.max(0, Math.min(1, value))
    if (next === this.pace) return
    const changed = Math.abs(next - this.pace) > 0.001
    this.pace = next

    // A rhythmic pace wants a plucked attack; an ambient one wants a swell.
    this.lead.set({ envelope: { attack: 1.6 - this.pace * 1.5, release: 7 - this.pace * 5 } })
    this.pulseGain.gain.rampTo(this.pace < 0.45 ? 0 : (this.pace - 0.45) * 0.9, 1.2)

    // scheduleRepeat fixes its interval at registration, so a pace change has
    // to re-register the events rather than mutate them.
    if (changed && this.running) this.scheduleVoices()
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

    this.scheduleVoices()
  }

  private scheduleVoices() {
    const transport = engine.transport
    this.clearVoices()

    // Lead voice. Each hit re-rolls its own length, velocity and octave, so the
    // texture never settles into a repeating pattern even at a steady pace.
    this.leadEvent = transport.scheduleRepeat((time) => {
      const chance = 0.14 + this.density * 0.4 + this.pace * 0.32
      if (Math.random() > chance) return
      this.degree = nextDegree(this.degree, this.scale.length)
      const freq = this.scale[this.degree]
      const dur = (2 + Math.random() * 6) * (1 - this.pace * 0.82)
      const vel = 0.2 + Math.random() * 0.35 + this.pace * 0.12
      this.lead.triggerAttackRelease(freq, dur, time, vel)

      // Occasionally shadow the note a fifth or octave up for a shimmer.
      if (Math.random() < 0.22) {
        const partner = Math.random() < 0.5 ? freq * 1.5 : freq * 2
        if (partner < 2400) {
          this.lead.triggerAttackRelease(partner, dur * 0.7, time + this.leadInterval * 0.25, vel * 0.5)
        }
      }
    }, this.leadInterval)

    // Pad voice: slow consonant clusters built from the root's harmonic series.
    // It stays slow at every pace — it is the horizon the pulse moves against.
    this.padEvent = transport.scheduleRepeat((time) => {
      if (Math.random() > 0.45) return
      const base = this.scale[Math.floor(Math.random() * this.scale.length)]
      const voicing = [1, 3 / 2, 2][Math.floor(Math.random() * 3)]
      const notes = [base, base * voicing].filter((f) => f > 80 && f < 2000)
      this.pad.triggerAttackRelease(notes, 14 + Math.random() * 10, time, 0.16)
    }, 11)

    // Pulse: a low root on a strict grid. Silent below the pace threshold, so
    // an ambient session never hears it.
    this.pulseEvent = transport.scheduleRepeat((time) => {
      if (this.pace < 0.45) return
      // Every other beat gets a lighter accent, which reads as a bar rather
      // than an undifferentiated tick.
      const strong = Math.random() > 0.25
      this.pulse.triggerAttackRelease(
        carrierFor(this.root) / 2,
        0.14,
        time,
        strong ? 0.9 : 0.45,
      )
    }, this.leadInterval * 2)
  }

  private clearVoices() {
    const transport = engine.transport
    for (const id of [this.leadEvent, this.padEvent, this.pulseEvent]) {
      if (id !== null) transport.clear(id)
    }
    this.leadEvent = null
    this.padEvent = null
    this.pulseEvent = null
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.clearVoices()
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
    this.pulse.dispose()
    this.pulseGain.dispose()
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
