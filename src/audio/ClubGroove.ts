import { Tone, engine } from './ToneEngine'
import { foldToRange } from './scale'
import type { ClubStyle } from '../lib/types'

/**
 * The club layer — techno, trance, psytrance and deep house — built on the same
 * anchoring rule as everything else.
 *
 * This is a deliberate exception to how the rest of the melody engine works,
 * and it is worth being explicit about why. The ambient layer was rewritten to
 * remove every fixed period, because a loop that repeats under a meditation is
 * the thing people complain about. These four are the opposite: the repetition
 * IS the form. A four-on-the-floor kick that wandered off the grid would not be
 * a more interesting track, it would be a broken one.
 *
 * So here the grid is real: one 16th-note step clock, a bar counter, and
 * sections that turn voices on and off as the arrangement moves. What still
 * refuses to repeat is the material — the figure is regenerated every few bars,
 * and every pitch, kick included, is a whole-number ratio of the session's
 * target frequency.
 *
 * What separates the styles is not the tempo, which is the easy part. It is
 * where the bass sits against the kick (under it, between the kicks, rolling
 * through the gaps, or long and syncopated), whether the off-16ths are straight
 * or shuffled, whether the harmony is arpeggiated or stabbed as a chord, and
 * whether the arrangement is allowed to tear the floor down at all. Each of
 * those is one switch below, and together they are the genres.
 *
 * The kick deserves a note of its own: it is the target frequency, folded down
 * by octaves until it lands where a kick drum lives. On a 528 Hz session the
 * kick is 66 Hz; on 396 Hz it is 49.5 Hz. Nothing is borrowed from a sample
 * library, and the loudest thing in the mix is the frequency itself.
 */

const STEPS_PER_BAR = 16

/** Bars in one arrangement cycle. Trance and psy breathe over a longer span. */
const CYCLE_BARS: Record<ClubStyle, number> = {
  techno: 16,
  trance: 32,
  psytrance: 32,
  deephouse: 16,
  organichouse: 16,
  // Trippy is the longest arrangement here on purpose: the whole point of it is
  // that you stop noticing where the bar line is, and a sixteen-bar cycle keeps
  // reminding you.
  trippy: 32,
}

/** Base tempo before `pace` nudges it. */
const BASE_BPM: Record<ClubStyle, number> = {
  techno: 126,
  trance: 136,
  psytrance: 144,
  deephouse: 122,
  // Organic house lives a few BPM under deep house — the hand percussion needs
  // the room, and above about 120 it stops sounding played and starts sounding
  // programmed.
  organichouse: 118,
  trippy: 104,
}

/**
 * Shuffle, as a fraction of a 16th pushed onto the off-16ths.
 *
 * Deep house is the only style here that swings, and it is not a detail — a
 * straight deep-house groove sounds like slow techno. Everything else in the
 * genre (the soft kick, the offbeat open hat, the chord stabs) is sitting on
 * top of that shuffle.
 */
const SWING: Record<ClubStyle, number> = {
  techno: 0,
  trance: 0,
  psytrance: 0,
  deephouse: 0.22,
  // Deeper than deep house. This is the difference between a shuffle and a
  // groove played by hands that are not quite on the grid.
  organichouse: 0.3,
  trippy: 0.16,
}

/** Per-style kick shaping. The drum is the genre's signature as much as the tempo. */
const KICK_SHAPE: Record<ClubStyle, { pitchDecay: number; decay: number; volume: number }> = {
  // Punchy and short, with a fast pitch drop.
  techno: { pitchDecay: 0.048, decay: 0.34, volume: -6 },
  trance: { pitchDecay: 0.042, decay: 0.3, volume: -6 },
  // Psy kicks are tight and get out of the way fast, because the bass roll
  // needs the rest of the beat to itself.
  psytrance: { pitchDecay: 0.028, decay: 0.2, volume: -5 },
  // Deep house is rounder and softer: a longer pitch fall, less click, and it
  // sits lower in the mix than in any of the others.
  deephouse: { pitchDecay: 0.075, decay: 0.42, volume: -9 },
  // Softer again, and longer: an organic house kick is felt more than heard,
  // and the percussion on top is what you actually follow.
  organichouse: { pitchDecay: 0.09, decay: 0.5, volume: -11 },
  // Slow, long and deliberately soft — it marks time rather than driving.
  trippy: { pitchDecay: 0.11, decay: 0.62, volume: -10 },
}

/**
 * Tempo for a style and pace. Exported so the mixer can show the real number
 * rather than a second copy of this arithmetic that drifts out of step.
 */
export function clubBpm(style: ClubStyle, pace: number): number {
  return BASE_BPM[style] + (Math.max(0, Math.min(1, pace)) - 0.5) * 16
}

type Section = {
  kick: boolean
  clap: boolean
  bass: boolean
  arp: boolean
  hats: boolean
  /** Arp filter cutoff in Hz — the single strongest cue of where you are. */
  cutoff: number
  /** Extra reverb during a breakdown, so the room opens as the floor empties. */
  wet: number
}

export class ClubGroove {
  private out: Tone.Gain
  private reverb: Tone.Reverb
  private delay: Tone.FeedbackDelay
  private arpFilter: Tone.Filter
  private arp: Tone.PolySynth<Tone.Synth>
  private bass: Tone.MonoSynth
  private kick: Tone.MembraneSynth
  private clap: Tone.NoiseSynth
  private hat: Tone.NoiseSynth
  private wood: Tone.MembraneSynth

  private style: ClubStyle = 'techno'
  private scale: number[] = []
  private root = 528
  private pace = 0.5
  private density = 0.6
  private depth = 0

  private stepEvent: number | null = null
  private step = 0
  /** Chord-tone offsets for the current figure, `null` for a rest. */
  private figure: (number | null)[] = []
  /** The scale-degree offsets the current figure is drawn from. */
  private chord: number[] = [0, 2, 4]
  private base = 0
  /** Scale indices spanning one octave — 7 for the major set, 5 for pentatonic. */
  private octaveStep = 7
  private running = false

  constructor(destination: Tone.InputNode) {
    this.out = new Tone.Gain(1).connect(destination)

    this.reverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.02, wet: 0.22 }).connect(this.out)
    // A dotted-eighth delay is the trance cliché for a reason: it fills the gaps
    // between arp notes without adding notes of its own. Time is set with the
    // tempo in `retime`.
    this.delay = new Tone.FeedbackDelay({
      maxDelay: 2,
      delayTime: 0.33,
      feedback: 0.34,
      wet: 0.26,
    }).connect(this.reverb)

    this.arpFilter = new Tone.Filter({ type: 'lowpass', frequency: 800, rolloff: -24, Q: 3 }).connect(
      this.delay,
    )
    this.arp = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.14, sustain: 0.08, release: 0.14 },
      volume: -20,
    }).connect(this.arpFilter)
    this.arp.maxPolyphony = 8

    // Bass and kick stay dry. Everything that defines the floor has to be
    // punchy, and reverb on a sub is mud.
    this.bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', rolloff: -24, Q: 2 },
      filterEnvelope: { attack: 0.002, decay: 0.12, sustain: 0.2, release: 0.1, baseFrequency: 90, octaves: 2.4 },
      envelope: { attack: 0.004, decay: 0.16, sustain: 0.15, release: 0.09 },
      volume: -14,
    }).connect(this.out)

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.048,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.34, sustain: 0, release: 0.08 },
      volume: -6,
    }).connect(this.out)

    this.clap = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.002, decay: 0.16, sustain: 0 },
      volume: -20,
    }).connect(new Tone.Filter({ type: 'bandpass', frequency: 1600, Q: 1.1 }).connect(this.reverb))

    this.hat = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
      volume: -26,
    }).connect(new Tone.Filter({ type: 'highpass', frequency: 7000 }).connect(this.out))

    /**
     * Wood: the conga, rim and shaker of the organic house kit.
     *
     * Struck rather than hissed, which is the whole difference from the hat. A
     * `MembraneSynth` with almost no pitch fall and a short decay is a hand
     * drum: there is a definite pitch in it, briefly, and then a body. Filtered
     * to take off the sub so it never competes with the kick, and sent to the
     * room rather than dry, because hand percussion in a recording is always in
     * a space.
     */
    this.wood = new Tone.MembraneSynth({
      pitchDecay: 0.012,
      octaves: 1.6,
      envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.05 },
      volume: -17,
    }).connect(
      new Tone.Filter({ type: 'highpass', frequency: 240 }).connect(
        new Tone.Filter({ type: 'lowpass', frequency: 5200 }).connect(this.reverb),
      ),
    )
  }

  // ------------------------------------------------------------------ tempo

  private get bpm() {
    // `pace` keeps meaning what it means everywhere else — how driving the
    // session is — but within a range that is still the genre.
    return clubBpm(this.style, this.pace)
  }

  private get stepSeconds() {
    return 60 / this.bpm / 4
  }

  setStyle(style: ClubStyle) {
    if (style === this.style) return
    this.style = style
    this.applyStyleVoicing()
    this.regenerate()
    this.retime()
  }

  /** Timbres that belong to the genre rather than to the arrangement. */
  private applyStyleVoicing() {
    const k = KICK_SHAPE[this.style]
    this.kick.set({
      pitchDecay: k.pitchDecay,
      volume: k.volume,
      envelope: { attack: 0.001, decay: k.decay, sustain: 0, release: 0.08 },
    })

    // Organic house voices its chords like deep house — it is deep house, played
    // differently — so both take the warm stab rather than the saw.
    const house = this.style === 'deephouse' || this.style === 'organichouse'
    const trippy = this.style === 'trippy'
    // Deep house voices chords, not a saw arpeggio: a triangle with a slow
    // release reads as a warm electric-piano stab, which is the sound the genre
    // is built on. A sawtooth here would just be trance played slowly.
    this.arp.set({
      oscillator: { type: house ? 'triangle' : 'sawtooth' },
      envelope: house
        ? { attack: 0.012, decay: 0.5, sustain: 0.12, release: 0.9 }
        : { attack: 0.005, decay: 0.14, sustain: 0.08, release: 0.14 },
      volume: house ? -22 : -20,
    })
    // Trippy sits between psy's resonance and house's softness, and its filter
    // is the instrument — see the sweep in `section`.
    this.arpFilter.Q.rampTo(this.style === 'psytrance' ? 6 : trippy ? 4.5 : house ? 1.2 : 3, 0.5)

    // The psy bass roll only works if each note is gone before the next lands.
    this.bass.set({
      envelope: this.style === 'psytrance'
        ? { attack: 0.002, decay: 0.09, sustain: 0.02, release: 0.05 }
        : house
          ? { attack: 0.008, decay: 0.3, sustain: 0.4, release: 0.25 }
          : { attack: 0.004, decay: 0.16, sustain: 0.15, release: 0.09 },
      oscillator: { type: house ? 'sine' : 'sawtooth' },
      volume: house ? -11 : -14,
    })

    // Open hats need a tail; closed ones must not have one.
    this.hat.set({
      envelope: { attack: 0.001, decay: house ? 0.06 : 0.035, sustain: 0 },
      volume: house ? -24 : -26,
    })
  }

  setPace(value: number) {
    const next = Math.max(0, Math.min(1, value))
    if (Math.abs(next - this.pace) < 0.001) return
    this.pace = next
    this.retime()
  }

  setDensity(value: number) {
    this.density = Math.max(0, Math.min(1, value))
  }

  /** Depth widens the arp's tail without touching the floor. */
  setDepth(value: number) {
    this.depth = Math.max(0, Math.min(1, value))
    const trippy = this.style === 'trippy'
    this.delay.feedback.rampTo(trippy ? 0.58 + this.depth * 0.16 : 0.34 + this.depth * 0.22, 1.5)
    this.reverb.wet.rampTo(0.22 + this.depth * 0.2, 1.5)
  }

  /**
   * Retunes to a new root. The scale comes from the melody so both layers are
   * demonstrably built from the same pitch set.
   */
  setRoot(rootHz: number, scale: number[]) {
    this.root = rootHz
    this.scale = scale
    // playableScale folds four octaves into three, so this recovers the number
    // of degrees in one — 7 for the major and harmonic sets, 5 for pentatonic.
    this.octaveStep = Math.max(3, Math.round(scale.length / 3))
    this.base = Math.max(0, Math.floor(scale.length * 0.35))
    // The kick's pitch is passed on every hit rather than stored on the synth,
    // so retuning is nothing more than remembering the new root.
    this.regenerate()
  }

  private retime() {
    // The delay is tied to the tempo, so the repeats land between the notes
    // rather than drifting across them.
    //
    // Trippy takes a dotted-eighth instead of the usual three-sixteenths, and
    // far more of it. That interval against a four-four bar is the oldest dub
    // trick there is: the repeats never line up with the beat, so a sparse part
    // fills the bar with something that keeps arriving from the wrong place.
    const trippy = this.style === 'trippy'
    this.delay.delayTime.rampTo(this.stepSeconds * (trippy ? 6 : 3), 0.4)
    this.delay.feedback.rampTo(trippy ? 0.58 + this.depth * 0.16 : 0.34 + this.depth * 0.22, 0.6)
    this.delay.wet.rampTo(trippy ? 0.46 : 0.26, 0.6)
    if (this.running) this.schedule()
  }

  // ------------------------------------------------------------- arrangement

  /**
   * Where the arrangement is at a given bar.
   *
   * Trance runs the full shape — sixteen bars of drive, the floor drops out for
   * a breakdown, the filter climbs through a build, then everything returns.
   * Techno stays on the floor almost throughout and reduces instead: the
   * arpeggio strips away for two bars and comes back, which is how the genre
   * creates movement without ever letting go of the kick.
   */
  private section(bar: number): Section {
    const pos = bar % CYCLE_BARS[this.style]

    if (this.style === 'deephouse') {
      // No drops, ever. Deep house rolls, and the movement comes from the
      // chords dropping out for a couple of bars and the filter breathing —
      // an arrangement that kept tearing the floor down would be a different
      // genre wearing the tempo.
      const sweep = Math.sin((pos / CYCLE_BARS.deephouse) * Math.PI * 2)
      return {
        kick: true,
        clap: pos >= 1,
        bass: true,
        arp: pos < 12 || pos >= 14,
        hats: true,
        cutoff: 1400 + sweep * 900,
        wet: 0.3,
      }
    }

    if (this.style === 'organichouse') {
      // The same rolling shape as deep house — no drops, because this is deep
      // house — but the movement is the percussion thinning rather than the
      // chords leaving, and the filter breathes over a slower curve.
      const sweep = Math.sin((pos / CYCLE_BARS.organichouse) * Math.PI * 2)
      return {
        kick: true,
        clap: pos >= 2,
        bass: true,
        arp: pos < 13,
        hats: pos % 8 < 6,
        cutoff: 1150 + sweep * 700,
        wet: 0.36,
      }
    }

    if (this.style === 'trippy') {
      /**
       * No sections in the club sense: no build, no drop, nothing that resolves.
       *
       * What moves instead is the filter, on a slow cycle that never sits
       * still, and the kick going away for a stretch and coming back without
       * announcing either. The point is to lose track of where you are, and an
       * arrangement with a shape is exactly what would let you find out.
       */
      const cycle = CYCLE_BARS.trippy
      const slow = Math.sin((pos / cycle) * Math.PI * 2)
      const slower = Math.sin((pos / cycle) * Math.PI * 2 * 0.5 + 1.1)
      return {
        kick: pos < 10 || pos >= 16,
        clap: false,
        bass: true,
        arp: true,
        hats: pos >= 6,
        cutoff: 760 + slow * 520 + slower * 380,
        wet: 0.44 + slower * 0.1,
      }
    }

    if (this.style === 'psytrance') {
      if (pos < 20) {
        return {
          kick: true,
          clap: false,
          bass: true,
          arp: pos >= 4,
          hats: true,
          cutoff: 700 + (pos / 20) * 3000,
          wet: 0.24,
        }
      }
      if (pos < 26) {
        // The psy breakdown drops the roll, not just the kick — the bassline is
        // the thing the floor is riding, so leaving it in would keep the drive
        // that the breakdown exists to release.
        return { kick: false, clap: false, bass: false, arp: true, hats: false, cutoff: 800, wet: 0.6 }
      }
      const t = (pos - 26) / 6
      return {
        kick: pos >= 28,
        clap: false,
        bass: pos >= 28,
        arp: true,
        hats: true,
        cutoff: 800 + t * 5200,
        wet: 0.6 - t * 0.36,
      }
    }

    if (this.style === 'techno') {
      const stripped = pos >= 14
      // A slow sweep across the cycle, so no two bars sound identical even
      // though the pattern beneath them is steady.
      const sweep = Math.sin((pos / CYCLE_BARS.techno) * Math.PI)
      return {
        kick: true,
        clap: pos >= 2,
        bass: true,
        arp: !stripped,
        hats: pos >= 1,
        cutoff: 620 + sweep * 2400,
        wet: 0.22,
      }
    }

    if (pos < 16) {
      return {
        kick: true,
        clap: true,
        bass: true,
        arp: true,
        hats: true,
        cutoff: 900 + (pos / 16) * 2600,
        wet: 0.22,
      }
    }
    if (pos < 20) {
      // Breakdown: the floor goes, the room arrives.
      return { kick: false, clap: false, bass: false, arp: true, hats: false, cutoff: 900, wet: 0.55 }
    }
    if (pos < 24) {
      // Build: hats return, the bass comes back late, the filter climbs.
      const t = (pos - 20) / 4
      return {
        kick: false,
        clap: false,
        bass: pos >= 22,
        arp: true,
        hats: true,
        cutoff: 900 + t * 4600,
        wet: 0.55 - t * 0.3,
      }
    }
    // Drop.
    return { kick: true, clap: true, bass: true, arp: true, hats: true, cutoff: 4200, wet: 0.2 }
  }

  /**
   * Draws a new arpeggio figure.
   *
   * Built on the triad — every other scale degree, which is a chord in a
   * five-note scale as much as a seven-note one — plus one colour tone drawn
   * from the degrees the triad skips.
   *
   * That colour tone is not decoration, it is the whole point. A triad of
   * degrees 0, 2 and 4 lands on 1, 5/4 and 3/2 in EVERY scale this app has,
   * because the sets only differ at the degrees a triad steps over. An earlier
   * version arpeggiated the triad alone, and the measurement was unambiguous:
   * a psychedelic day, which switches the melody to the upper harmonic series,
   * played the identical three pitches as a plain one. Depth now steers the
   * draw towards those skipped degrees — 11/8, 13/8 and 7/4 — so the promise a
   * psychedelic set makes is one the arpeggio can actually keep.
   *
   * Downbeats are always played; the rest are thinned by density, which is what
   * separates a sparse techno groove from a busy one.
   */
  private regenerate() {
    if (!this.scale.length) return
    const skipped = this.depth >= 0.5 ? [3, 5, 6] : [1, 3, 5]
    const colour = skipped[Math.floor(Math.random() * skipped.length)]
    const chord = [0, 2, 4, colour].sort((a, b) => a - b)
    this.chord = chord

    if (this.style === 'deephouse') {
      // House does not arpeggiate, it stabs. The chord lands on the offbeat
      // eighths — against the kick, never with it — which is where the genre's
      // push comes from, with an occasional pickup before the bar turns over.
      this.figure = Array.from({ length: STEPS_PER_BAR }, (_, i) => {
        if (i % 4 === 2) return 0
        if (i === 15 && Math.random() < this.density * 0.7) return 0
        if (i % 8 === 7 && Math.random() < this.density * 0.4) return 0
        return null
      })
      return
    }

    const rising = Math.random() < 0.6
    const octaveJump = Math.random() < 0.45
    this.figure = Array.from({ length: STEPS_PER_BAR }, (_, i) => {
      const onBeat = i % 4 === 0
      if (!onBeat) {
        // Thinning happens in two stages, because dropping random 16ths does
        // not produce a minimal groove — it produces a busy one with holes.
        // Below half density the figure moves to eighths first, and only then
        // starts losing notes.
        if (this.density < 0.5 && i % 2 !== 0) return null
        if (Math.random() > this.density * 0.95) return null
      }
      const walk = rising ? i : STEPS_PER_BAR - 1 - i
      let offset = chord[walk % chord.length]
      if (octaveJump && i % 8 === 7) offset += this.octaveStep
      return offset
    })
  }

  // ---------------------------------------------------------------- sequencer

  start() {
    if (this.running) return
    this.running = true
    this.step = 0
    if (!this.figure.length) this.regenerate()
    this.retime()
    this.schedule()
  }

  private schedule() {
    this.clear()
    this.stepEvent = engine.transport.scheduleRepeat((time) => {
      if (!this.running) return
      this.tick(time)
    }, this.stepSeconds)
  }

  private tick(rawTime: number) {
    const step = this.step++
    const inBar = step % STEPS_PER_BAR
    const bar = Math.floor(step / STEPS_PER_BAR)
    const s = this.section(bar)
    // Shuffle pushes the off-16ths late. The kick and the downbeats are left
    // exactly where they were: a swung kick is a mistake, not a groove.
    const swung = inBar % 2 === 1 ? rawTime + SWING[this.style] * this.stepSeconds : rawTime
    const time = swung

    if (inBar === 0) {
      // A bar is this engine's note, and a four-bar figure change is its phrase.
      engine.notePulse(bar % 4 === 0)
      this.arpFilter.frequency.rampTo(s.cutoff, this.stepSeconds * STEPS_PER_BAR, time)
      this.reverb.wet.rampTo(s.wet + this.depth * 0.18, 1.5, time)
      // A new figure every four bars: long enough to lock onto, short enough
      // that the track keeps moving.
      if (bar % 4 === 0) this.regenerate()
    }

    if (s.kick) {
      if (this.style === 'trippy') {
        // Not four on the floor. The downbeat, and a second one late in the bar
        // that moves — which is what stops it reading as a slow house track and
        // starts it reading as something you are inside rather than facing.
        const second = bar % 2 === 0 ? 10 : 11
        if (inBar === 0) this.kick.triggerAttackRelease(foldToRange(this.root, 38, 76), 0.3, time, 1)
        else if (inBar === second) {
          this.kick.triggerAttackRelease(foldToRange(this.root, 38, 76), 0.3, time, 0.72)
        }
      } else if (inBar % 4 === 0) {
        this.kick.triggerAttackRelease(foldToRange(this.root, 38, 76), 0.24, time, 1)
      }
    }

    // Backbeat, on two and four.
    if (s.clap && (inBar === 4 || inBar === 12)) {
      if (this.style === 'organichouse') {
        // A rim, not a clap: shorter, drier and pitched, which is most of what
        // makes the groove sound struck rather than triggered.
        this.wood.triggerAttackRelease(foldToRange(this.root, 300, 600), 0.028, time, 0.55)
      } else if (this.style !== 'trippy') {
        this.clap.triggerAttackRelease(0.14, time, 0.8)
      }
    }

    /**
     * Hand percussion, on organic house only.
     *
     * The pattern is deliberately not a subdivision of the bar — it repeats
     * every three 16ths against a four-beat bar, so it walks around the grid
     * and lands somewhere different in each of the four beats. That is the
     * cheapest honest imitation of a player who is not counting, and it is what
     * the genre is named for.
     */
    if (this.style === 'organichouse' && s.hats && inBar % 3 === 1) {
      const late = time + this.stepSeconds * 0.12
      // Two pitches alternating, the way a pair of congas is played.
      const high = inBar % 6 === 1
      this.wood.triggerAttackRelease(
        foldToRange(this.root, high ? 420 : 260, high ? 840 : 520),
        0.02,
        late,
        high ? 0.4 : 0.24,
      )
    }

    if (s.hats) {
      // Offbeat eighths — the pulse between the kicks. In deep house that hit
      // is the open hat and it carries the groove; in psy the 16ths underneath
      // are what makes the tempo feel like 144 rather than 120.
      if (this.style === 'trippy') {
        // One shaker, off the beat, and nothing else up here — the delay is
        // carrying the time.
        if (inBar % 8 === 6) this.hat.triggerAttackRelease(0.05, time, 0.42)
      } else if (inBar % 4 === 2) this.hat.triggerAttackRelease(0.06, time, 0.8)
      else if (this.style === 'psytrance') this.hat.triggerAttackRelease(0.018, time, 0.3)
      else if (inBar % 2 === 1 && this.density > 0.55) {
        this.hat.triggerAttackRelease(0.02, time, 0.35)
      }
    }

    if (s.bass) this.playBass(inBar, time)
    if (s.arp) this.playArp(inBar, time)
  }

  /**
   * Where the bass sits relative to the kick is most of what separates these
   * genres to the ear, and it costs one switch here.
   *
   * Techno puts it under the kick. Trance puts it between the kicks. Psytrance
   * rolls it — the kick takes the downbeat and the bass fills the other three
   * 16ths of every beat, which is the sound the whole genre is named for. Deep
   * house plays a long sub on the beat with a syncopated pickup, and lets the
   * chords do the pushing instead.
   */
  private playBass(inBar: number, time: number) {
    if (!this.scale.length) return
    const beatStep = inBar % 4
    let hit: boolean
    let length = this.stepSeconds * 1.6
    let velocity = 0.85
    switch (this.style) {
      case 'trance':
        hit = beatStep === 2
        break
      case 'psytrance':
        // Every 16th except the one the kick is on.
        hit = beatStep !== 0
        length = this.stepSeconds * 0.62
        velocity = beatStep === 2 ? 0.9 : 0.72
        break
      case 'deephouse':
        hit = beatStep === 0 || inBar % 8 === 6
        length = this.stepSeconds * 3.2
        velocity = 0.7
        break
      case 'organichouse':
        // Short and plucked where deep house is long and sustained, with a
        // pickup into the next bar. A fingered bass does not hold.
        hit = beatStep === 0 || inBar === 7 || inBar === 14
        length = this.stepSeconds * 0.9
        velocity = inBar === 0 ? 0.82 : 0.62
        break
      case 'trippy':
        // Long, sparse and syncopated: two notes a bar, neither on a beat you
        // would tap.
        hit = inBar === 2 || inBar === 9
        length = this.stepSeconds * 5
        velocity = 0.68
        break
      default:
        hit = beatStep === 0 || inBar % 8 === 6
    }
    if (!hit) return
    const degree = this.figure[inBar] ?? this.chord[Math.floor(inBar / 4) % this.chord.length]
    // Folding to a sub register collapses octaves anyway, so the bass only has
    // to agree with the figure's pitch class.
    const pitch = this.scale[Math.min(this.scale.length - 1, this.base + degree)]
    this.bass.triggerAttackRelease(foldToRange(pitch, 55, 110), length, time, velocity)
  }

  private playArp(inBar: number, time: number) {
    if (!this.scale.length) return
    const offset = this.figure[inBar]
    if (offset === null || offset === undefined) return

    const pitchAt = (o: number) =>
      foldToRange(this.scale[Math.min(this.scale.length - 1, this.base + o)], 220, 880)

    if (this.style === 'deephouse') {
      // The whole chord at once, held long enough to overlap the next one. Four
      // voices rather than three: the colour tone is what makes a house chord
      // sound like a seventh instead of a plain triad.
      const notes = [...new Set(this.chord.map(pitchAt))]
      this.arp.triggerAttackRelease(notes, this.stepSeconds * 5, time, 0.42)
      return
    }

    const accent = inBar % 4 === 0 ? 0.75 : 0.5
    this.arp.triggerAttackRelease(pitchAt(offset), this.stepSeconds * 1.4, time, accent)
  }

  private clear() {
    if (this.stepEvent !== null) engine.transport.clear(this.stepEvent)
    this.stepEvent = null
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.clear()
    this.arp.releaseAll()
  }

  dispose() {
    this.stop()
    this.arp.dispose()
    this.bass.dispose()
    this.kick.dispose()
    this.clap.dispose()
    this.hat.dispose()
    this.wood.dispose()
    this.arpFilter.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.out.dispose()
  }
}
