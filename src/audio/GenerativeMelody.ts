import { Tone, engine } from './ToneEngine'
import { ClubGroove } from './ClubGroove'
import { SCALES, carrierFor, nextDegree, playableScale, scaleForRoot } from './scale'
import { isClubStyle, type MelodyStyle } from '../lib/types'

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
  private panner: Tone.AutoPanner
  private baseDelay: number

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
  /** 0 = plain and grounded, 1 = swirling and unmoored. */
  private depth = 0
  private style: MelodyStyle = 'ambient'
  /** Built on first use — an ambient session never pays for it. */
  private club: ClubGroove | null = null
  /**
   * The organic voice, likewise built only when it is chosen.
   *
   * A plucked string rather than another envelope on the same oscillator. That
   * is the whole point of the style: ambient's lead *swells*, and no attack
   * setting on a triangle wave turns a swell into a struck note — the body is
   * wrong, not just the shape. Karplus-Strong gives a real excitation and a
   * real decay, which is what makes this read as an instrument being played in
   * a room instead of a pad being faded up.
   */
  private pluck: Tone.PluckSynth | null = null
  private pluckGain: Tone.Gain | null = null
  private leadEvent: number | null = null
  private padEvent: number | null = null
  private pulseEvent: number | null = null
  /** Notes still owed in the current phrase; 0 means the next event is a rest. */
  private phraseLeft = 0
  private running = false

  constructor(destination: Tone.InputNode) {
    this.out = new Tone.Gain(1).connect(destination)

    this.reverb = new Tone.Reverb({ decay: 9, preDelay: 0.06, wet: 0.55 }).connect(this.out)
    // maxDelay has to be declared up front: it sizes the underlying buffer, and
    // depth pushes delayTime as far as 1.35s, past the 1s default.
    // Delay time is drawn per session and sits deliberately off any round
    // number: a fixed 0.75s echo at high feedback is itself a metronome, and it
    // was beating against the note grid. Lower feedback keeps it as colour
    // rather than as a rhythm.
    this.baseDelay = 1.13 + Math.random() * 0.74
    this.delay = new Tone.FeedbackDelay({
      maxDelay: 4,
      delayTime: this.baseDelay,
      feedback: 0.28,
      wet: 0.26,
    }).connect(this.reverb)
    // Stereo motion is a big part of the psychedelic character; at depth 0 it
    // is fully bypassed so an ordinary session stays still.
    this.panner = new Tone.AutoPanner({ frequency: 0.05, depth: 0.9, wet: 0 })
      .connect(this.delay)
      .start()
    this.chorus = new Tone.Chorus({ frequency: 0.15, delayTime: 6, depth: 0.5, wet: 0.35 })
      .connect(this.panner)
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
    this.club?.setPace(next)

    // A rhythmic pace wants a plucked attack; an ambient one wants a swell.
    this.lead.set({ envelope: { attack: 1.6 - this.pace * 1.5, release: 7 - this.pace * 5 } })
    this.pulseGain.gain.rampTo(this.pulseLevel, 1.2)

    // scheduleRepeat fixes its interval at registration, so a pace change has
    // to re-register the events rather than mutate them.
    if (changed && this.running) this.scheduleVoices()
  }

  /**
   * Silent below the threshold, always silent when a kick is playing, and
   * silent on organic — a plucked line already has its own attack, and a sine
   * blip under every note turns an instrument into a metronome.
   */
  private get pulseLevel() {
    if (this.style !== 'ambient') return 0
    return this.pace < 0.45 ? 0 : (this.pace - 0.45) * 0.9
  }

  /**
   * The plucked voice, built the first time organic is chosen.
   *
   * Routed to the filter like the other voices, but through its own gain so the
   * style can sit at its own level: a struck note has a far higher peak than a
   * swell for the same perceived loudness, and matching them by ear on the
   * synth's own `volume` would have left organic spiking the master.
   */
  private ensurePluck() {
    if (this.pluck) return
    this.pluckGain = new Tone.Gain(0.9).connect(this.filter)
    this.pluck = new Tone.PluckSynth({
      // Longer than the default: a short string reads as a toy, and this has to
      // hold its own against a drone.
      attackNoise: 0.9,
      dampening: 2600,
      resonance: 0.93,
      release: 1.4,
    }).connect(this.pluckGain)
  }

  /**
   * Switches between the ambient engine and the club engine.
   *
   * They are not variations of each other. Ambient refuses to repeat; techno
   * and trance are built on a grid, and their voices — kick, offbeat bass,
   * arpeggio, hats — have no ambient counterpart. So the club layer is its own
   * object, and the voices that would fight it are stood down: the lead, whose
   * free phrases blur against a sequenced figure, and the pulse, whose whole
   * job the kick now does properly.
   *
   * The drone and the pad stay in both. The drone is the anchor the app is
   * built on and never leaves, and a slow pad underneath a trance arpeggio is
   * the genre, not an accident.
   */
  setStyle(style: MelodyStyle) {
    if (style === this.style) return
    this.style = style

    if (!isClubStyle(style)) {
      this.club?.stop()
      if (style === 'organic') this.ensurePluck()
    } else {
      if (!this.club) this.club = new ClubGroove(this.out)
      this.club.setStyle(style)
      this.club.setPace(this.pace)
      this.club.setDensity(this.density)
      this.club.setDepth(this.depth)
      this.club.setRoot(this.root, this.scale)
      if (this.running) this.club.start()
    }

    this.pulseGain.gain.rampTo(this.pulseLevel, 1.2)
    // The lead is scheduled, not gated, so the switch has to re-register.
    if (this.running) this.scheduleVoices()
  }

  /**
   * Psychedelic character. One dial moves the whole signal path together —
   * longer feedback, deeper chorus, wider stereo travel, a slower and broader
   * filter sweep — and past the halfway point the scale itself switches to the
   * upper harmonic series, which is where the unfamiliarity really comes from.
   */
  setDepth(value: number) {
    const next = Math.max(0, Math.min(1, value))
    if (next === this.depth) return
    const crossedScaleThreshold = next >= 0.5 !== this.depth >= 0.5
    this.depth = next

    this.delay.wet.rampTo(0.26 + next * 0.3, 2)
    this.delay.feedback.rampTo(0.28 + next * 0.28, 2)
    this.delay.delayTime.rampTo(this.baseDelay + next * 0.8, 2)
    this.chorus.wet.rampTo(0.35 + next * 0.35, 2)
    this.chorus.depth = 0.5 + next * 0.45
    this.panner.wet.rampTo(next * 0.85, 2)
    this.panner.frequency.rampTo(0.05 + next * 0.13, 2)

    // A wider, slower sweep makes the timbre feel like it is breathing.
    this.filterLfo.frequency.rampTo(0.021 - next * 0.012, 2)
    this.filterLfo.min = 620 - next * 300
    this.filterLfo.max = 2100 + next * 1400
    this.club?.setDepth(next)

    if (crossedScaleThreshold) this.setRoot(this.root)
  }

  private scaleName(rootHz: number) {
    return this.depth >= 0.5 ? ('harmonic' as const) : scaleForRoot(rootHz)
  }

  /** Retunes every voice to a new root without stopping playback. */
  setRoot(rootHz: number) {
    this.root = rootHz
    this.scale = playableScale(rootHz, SCALES[this.scaleName(rootHz)])
    this.degree = Math.floor(this.scale.length / 2)

    const droneHz = carrierFor(rootHz)
    const ramp = engine.now + 1.5
    this.drone.frequency.rampTo(droneHz, 1.5)
    this.droneSub.frequency.rampTo(droneHz / 2, 1.5)
    void ramp

    // The club layer composes from the same pitch set, not a parallel one.
    this.club?.setRoot(rootHz, this.scale)
  }

  setDensity(value: number) {
    this.density = Math.max(0, Math.min(1, value))
    this.club?.setDensity(this.density)
  }

  start() {
    if (this.running) return
    this.running = true
    if (!this.scale.length) this.setRoot(this.root)

    this.drone.start()
    this.droneSub.start()
    if (isClubStyle(this.style)) this.club?.start()

    this.scheduleVoices()
  }

  private scheduleVoices() {
    this.clearVoices()
    const now = engine.transport.seconds
    this.phraseLeft = 0
    // Both free styles get the phrase scheduler; only the club engine replaces
    // the lead with a sequence.
    if (!isClubStyle(this.style)) this.scheduleLead(now + 0.5)
    this.schedulePad(now + 2 + Math.random() * 6)
    this.schedulePulse()
  }

  /**
   * The lead, as phrases rather than as a grid.
   *
   * The previous version fired on a strict repeating interval and gated each
   * slot on probability. That leaves every note quantised to the same grid, and
   * the ear locks onto it — worse, it beat against the pad's own fixed period
   * so the line kept sliding out of step and back again.
   *
   * Now each note schedules the next one at a freshly drawn distance, and notes
   * come in runs of three to nine with a breath between them. Nothing repeats,
   * and a phrase reads as one continuous line instead of scattered pings.
   */
  private scheduleLead(at: number) {
    const transport = engine.transport
    this.leadEvent = transport.scheduleOnce((time) => {
      if (!this.running) return

      const base = this.leadInterval
      let gap: number

      // A plucked note is gone in a second or two, so organic plays closer
      // together and in longer runs. At ambient's spacing the same phrases came
      // out as isolated pings with silence between them.
      const organic = this.style === 'organic'

      if (this.phraseLeft > 0) {
        // Inside a phrase: notes stay close, with the spacing varying enough
        // that no two bars scan alike.
        gap = base * (0.55 + Math.random() * 0.9) * (organic ? 0.42 : 1)
        this.phraseLeft--
        this.playLeadNote(time, false)
      } else {
        // Between phrases: a longer breath, then a new run. Denser settings
        // shorten the breath and lengthen the run.
        // Density has to bite hard here. Phrases group notes together, so a
        // weak coupling leaves a "sparse" setting sounding busier than the old
        // grid did — which would wreck the work journeys, whose whole job is to
        // stay out of the way.
        gap = base * (2.5 + Math.random() * 4) * (1.9 - this.density * 1.2) * (organic ? 0.5 : 1)
        this.phraseLeft =
          1 + Math.floor(Math.random() * (2 + this.density * 7)) + (organic ? 3 : 0)
        // Open the phrase from a new place in the register so successive
        // phrases do not all start on the same note.
        this.degree = Math.floor(Math.random() * this.scale.length)
        this.playLeadNote(time, true)
      }

      this.scheduleLead(at + gap)
    }, at)
  }

  private playLeadNote(time: number, phraseStart: boolean) {
    if (!this.scale.length) return
    if (!phraseStart) this.degree = nextDegree(this.degree, this.scale.length)
    const freq = this.scale[this.degree]
    const dur = (2 + Math.random() * 6) * (1 - this.pace * 0.82)
    const vel = 0.18 + Math.random() * 0.3 + this.pace * 0.12 + (phraseStart ? 0.08 : 0)

    if (this.style === 'organic' && this.pluck && this.pluckGain) {
      /**
       * A string is struck and then left alone: there is no sustain to ask for
       * and no release to schedule, so `dur` says nothing here — which is why
       * the phrase scheduler shortens the gaps for this style instead.
       *
       * `PluckSynth` takes no velocity, so loudness is written onto its gain
       * just before the strike. Ramped rather than stepped, and only between
       * notes, so it shapes the attack without ever cutting a ringing string.
       *
       * `dampening` is moved with it. On a real instrument a harder strike is
       * also a brighter one, and holding the tone fixed while only the level
       * moves is what makes a sampled pluck sound like a sample.
       */
      this.pluckGain.gain.setTargetAtTime(0.5 + vel * 1.1, time - 0.02, 0.01)
      this.pluck.dampening = 1900 + vel * 3200
      this.pluck.triggerAttack(freq, time)
      // Struck an octave up as well when the register is low: a plucked note
      // near the drone disappears into it, and the octave keeps the line
      // audible without turning anything up.
      if (freq < this.root * 1.5 && Math.random() < 0.5) {
        this.pluck.triggerAttack(freq * 2, time + 0.09)
      }
      return
    }

    this.lead.triggerAttackRelease(freq, dur, time, vel)

    // Occasionally shadow the note a fifth or octave up for a shimmer.
    if (Math.random() < 0.22) {
      const partner = Math.random() < 0.5 ? freq * 1.5 : freq * 2
      if (partner < 2400) {
        this.lead.triggerAttackRelease(partner, dur * 0.7, time + 0.18 + Math.random() * 0.3, vel * 0.5)
      }
    }
  }

  /**
   * Pad clusters. Also self-rescheduling: a fixed 11-second repeat was the most
   * audible pattern in the whole piece, since a swell that regular reads as a
   * loop no matter how the notes above it move.
   */
  private schedulePad(at: number) {
    const transport = engine.transport
    this.padEvent = transport.scheduleOnce((time) => {
      if (!this.running) return
      if (this.scale.length) {
        const base = this.scale[Math.floor(Math.random() * this.scale.length)]
        const voicing = [1, 3 / 2, 2][Math.floor(Math.random() * 3)]
        const notes = [base, base * voicing].filter((f) => f > 80 && f < 2000)
        this.pad.triggerAttackRelease(notes, 14 + Math.random() * 12, time, 0.16)
      }
      this.schedulePad(at + 9 + Math.random() * 17)
    }, at)
  }

  /**
   * The pulse is the one voice that SHOULD be strictly periodic — it is the
   * beat. It stays on scheduleRepeat, and stays silent below the threshold.
   */
  private schedulePulse() {
    this.pulseEvent = engine.transport.scheduleRepeat((time) => {
      if (this.pulseLevel <= 0) return
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
    this.club?.stop()
    this.lead.releaseAll()
    this.pad.releaseAll()
    this.drone.stop()
    this.droneSub.stop()
  }

  dispose() {
    this.stop()
    this.club?.dispose()
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
    this.panner.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.out.dispose()
  }
}
