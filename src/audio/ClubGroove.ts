import { Tone, engine } from './ToneEngine'
import { foldToRange } from './scale'

/**
 * The club layer — techno and trance, built on the same anchoring rule as
 * everything else.
 *
 * This is a deliberate exception to how the rest of the melody engine works,
 * and it is worth being explicit about why. The ambient layer was rewritten to
 * remove every fixed period, because a loop that repeats under a meditation is
 * the thing people complain about. Techno and trance are the opposite: the
 * repetition IS the form. A four-on-the-floor kick that wandered off the grid
 * would not be a more interesting techno track, it would be a broken one.
 *
 * So here the grid is real: one 16th-note step clock, a bar counter, and
 * sections that turn voices on and off as the arrangement moves through drive,
 * breakdown, build and drop. What still refuses to repeat is the material —
 * the arpeggio figure is regenerated every few bars, and every pitch, kick
 * included, is a whole-number ratio of the session's target frequency.
 *
 * The kick deserves a note of its own: it is the target frequency, folded down
 * by octaves until it lands where a kick drum lives. On a 528 Hz session the
 * kick is 66 Hz; on 396 Hz it is 49.5 Hz. Nothing is borrowed from a sample
 * library, and the loudest thing in the mix is the frequency itself.
 */

export type ClubStyle = 'techno' | 'trance'

const STEPS_PER_BAR = 16

/** Bars in one arrangement cycle. Trance breathes over a longer span. */
const CYCLE_BARS: Record<ClubStyle, number> = { techno: 16, trance: 32 }

/** Base tempo before `pace` nudges it. */
const BASE_BPM: Record<ClubStyle, number> = { techno: 126, trance: 136 }

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
    this.retime()
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
    this.delay.feedback.rampTo(0.34 + this.depth * 0.22, 1.5)
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
    this.delay.delayTime.rampTo(this.stepSeconds * 3, 0.4)
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

  private tick(time: number) {
    const step = this.step++
    const inBar = step % STEPS_PER_BAR
    const bar = Math.floor(step / STEPS_PER_BAR)
    const s = this.section(bar)

    if (inBar === 0) {
      this.arpFilter.frequency.rampTo(s.cutoff, this.stepSeconds * STEPS_PER_BAR, time)
      this.reverb.wet.rampTo(s.wet + this.depth * 0.18, 1.5, time)
      // A new figure every four bars: long enough to lock onto, short enough
      // that the track keeps moving.
      if (bar % 4 === 0) this.regenerate()
    }

    if (s.kick && inBar % 4 === 0) {
      this.kick.triggerAttackRelease(foldToRange(this.root, 38, 76), 0.24, time, 1)
    }

    // Backbeat, on two and four.
    if (s.clap && (inBar === 4 || inBar === 12)) {
      this.clap.triggerAttackRelease(0.14, time, 0.8)
    }

    if (s.hats) {
      // Offbeat eighths — the pulse between the kicks.
      if (inBar % 4 === 2) this.hat.triggerAttackRelease(0.03, time, 0.75)
      else if (inBar % 2 === 1 && this.density > 0.55) {
        this.hat.triggerAttackRelease(0.02, time, 0.35)
      }
    }

    if (s.bass) this.playBass(inBar, time)
    if (s.arp) this.playArp(inBar, time)
  }

  /**
   * Techno puts the bass under the kick; trance puts it between the kicks. That
   * single placement difference is most of what separates the two genres to the
   * ear, and it costs one condition here.
   */
  private playBass(inBar: number, time: number) {
    if (!this.scale.length) return
    const hit = this.style === 'trance' ? inBar % 4 === 2 : inBar % 4 === 0 || inBar % 8 === 6
    if (!hit) return
    const degree = this.figure[inBar] ?? 0
    // Folding to a sub register collapses octaves anyway, so the bass only has
    // to agree with the figure's pitch class.
    const pitch = this.scale[Math.min(this.scale.length - 1, this.base + degree)]
    this.bass.triggerAttackRelease(foldToRange(pitch, 55, 110), this.stepSeconds * 1.6, time, 0.85)
  }

  private playArp(inBar: number, time: number) {
    if (!this.scale.length) return
    const offset = this.figure[inBar]
    if (offset === null || offset === undefined) return
    const idx = Math.min(this.scale.length - 1, this.base + offset)
    const pitch = foldToRange(this.scale[idx], 220, 880)
    const accent = inBar % 4 === 0 ? 0.75 : 0.5
    this.arp.triggerAttackRelease(pitch, this.stepSeconds * 1.4, time, accent)
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
    this.arpFilter.dispose()
    this.delay.dispose()
    this.reverb.dispose()
    this.out.dispose()
  }
}
