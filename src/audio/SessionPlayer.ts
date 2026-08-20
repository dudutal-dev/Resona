import { engine } from './ToneEngine'
import { Mixer } from './Mixer'
import { GenerativeMelody } from './GenerativeMelody'
import { BinauralGenerator } from './BinauralGenerator'
import { Ambience, BUILTIN_AMBIENCE, type AmbienceOption } from './Ambience'
import { mediaRoute } from './MediaRoute'
import { coverArtwork } from './artwork'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
import { diag } from '../lib/diagnostics'
import { translate } from '../lib/i18n'
import { useSettings } from '../store/settingsStore'
import { THEME_HUE, themeOf } from '../lib/themes'
import type { SessionConfig, TimerMode } from '../lib/types'

export const TIMER_MINUTES: Record<TimerMode, number | null> = {
  '15': 15,
  '30': 30,
  '60': 60,
  '120': 120,
  untilMorning: 480,
  unlimited: null,
  custom: null,
}

/** Resolves a config to a concrete length in minutes, or null for unlimited. */
export function resolveTimerMinutes(config: SessionConfig): number | null {
  if (config.timerMode === 'custom') return config.customMinutes ?? null
  return TIMER_MINUTES[config.timerMode]
}



/** Length of the closing fade (§4.6) — long enough to never jolt a sleeper. */
export const FADE_OUT_SECONDS = 18
const FADE_IN_SECONDS = 5

type Listener = () => void

/**
 * Owns one listening session: builds the three layers on first play, keeps them
 * in sync with the config, and ends with a gradual fade rather than a cut.
 */
class SessionPlayer {
  private mixer: Mixer | null = null
  private melody: GenerativeMelody | null = null
  private beat: BinauralGenerator | null = null
  private ambience: Ambience | null = null

  private playing = false
  private startedAt = 0
  private endsAt: number | null = null
  private fadeTimer: ReturnType<typeof setTimeout> | null = null
  private stopTimer: ReturnType<typeof setTimeout> | null = null
  private listeners = new Set<Listener>()
  private ambienceOptions: AmbienceOption[] | null = null
  private config: SessionConfig | null = null
  /** Set when the session was launched from a journey day, for the player card. */
  private journey: { journeyId: string; day: number } | null = null
  /**
   * Bumped by every play and every stop. Deferred work captures it and does
   * nothing if it no longer matches — the intent it belonged to is gone.
   */
  private generation = 0
  /** Whether the voices are actually running, as opposed to merely faded out. */
  private voicesLive = false
  /**
   * Set when the sound could not be got back automatically.
   *
   * There is a limit to what can be repaired without a gesture: a browser may
   * refuse to start a media element until the person touches something, and no
   * amount of trying changes that. Rather than leave a session that looks
   * healthy and plays nothing — which has now been reported twice — the player
   * says so, and the screen offers the one tap that is allowed to fix it.
   */
  private soundLost = false
  /**
   * How many times the manual repair has been asked for in this session.
   *
   * Each press tries something strictly stronger than the last, because the
   * weaker steps have been observed reporting success while the phone stayed
   * silent. The person is the only instrument that can tell whether there is
   * sound, so the ladder is climbed by them and not by a measurement.
   */
  private restoreStep = 0

  onChange(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  get isPlaying() {
    return this.playing
  }

  /** Whether the session is running but the sound is not reaching the output. */
  get isSoundLost() {
    return this.soundLost
  }

  setSoundLost(lost: boolean) {
    if (this.soundLost === lost) return
    this.soundLost = lost
    if (lost) diag('sound-lost')
    this.emit()
  }

  /**
   * The manual repair, behind a real gesture.
   *
   * Everything automatic has already been tried by the time this is offered, so
   * this does the two things a gesture makes newly possible: it rebuilds the
   * route, and it rebuilds the voices in case the graph is the half that died.
   */
  async restoreSound(): Promise<boolean> {
    this.restoreStep += 1
    diag('restore-pressed', `step ${this.restoreStep}`)
    await mediaRoute.resumeIfNeeded(this.playing)

    if (this.restoreStep === 1) {
      // Rebuild the stream, and the voices if the graph is the half that died.
      await mediaRoute.ensureRouteFlowing(true)
    } else if (this.restoreStep === 2) {
      // Discard the element itself. This is what relaunching the app did.
      await mediaRoute.hardRebuild()
    } else {
      // Out of the element path altogether: straight to the speaker, no stream
      // and no playback session to lose.
      await mediaRoute.toDirect()
    }

    this.restartVoices()
    // Deliberately not cleared here. Nothing in a browser can confirm that
    // sound is reaching the speaker, and saying "fixed" when it is not is how
    // the last two attempts ended. The card stays until the person stops
    // pressing it or the session is started again.
    this.emit()
    return true
  }

  /** Seconds since the session began, for the elapsed readout. */
  getElapsedSeconds(): number {
    if (!this.playing) return 0
    return Math.floor((Date.now() - this.startedAt) / 1000)
  }

  /** Seconds left on the timer, or null when running unlimited. */
  getRemainingSeconds(): number | null {
    if (!this.playing || this.endsAt === null) return null
    return Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000))
  }

  async getAmbienceOptions(): Promise<AmbienceOption[]> {
    if (this.ambienceOptions) return this.ambienceOptions
    // Building the graph requires a live context, so before the first play we
    // answer with the synthesised set and merge files in once we have one.
    if (!this.ambience) return BUILTIN_AMBIENCE
    this.ambienceOptions = await this.ambience.loadManifest()
    return this.ambienceOptions
  }

  private async ensureGraph() {
    await engine.start()
    if (this.mixer) return
    this.mixer = new Mixer()
    this.melody = new GenerativeMelody(this.mixer.input('melody'))
    this.beat = new BinauralGenerator(this.mixer.input('beat'))
    this.ambience = new Ambience(this.mixer.input('ambience'))
    void this.ambience.loadManifest().then((opts) => {
      this.ambienceOptions = opts
      this.emit()
    })
  }

  /** Must be invoked from a user gesture the first time. */
  async play(config: SessionConfig) {
    const generation = ++this.generation
    await this.ensureGraph()
    // Building the graph awaits; another play or stop may have landed while it
    // did, and that one is the newer intent.
    if (generation !== this.generation) return
    this.config = config
    this.clearTimers()

    this.applyConfig(config, true)

    this.melody!.start()
    this.beat!.start()
    this.ambience!.start()

    this.playing = true
    this.soundLost = false
    this.restoreStep = 0
    this.startedAt = Date.now()
    diag('play', `${config.rootId} ${config.style}`)
    // Only drop to silence when the voices really were torn down. Resuming
    // during a fade-out leaves them running, and slamming the fade to zero
    // first would put an audible hole in a session that never stopped.
    if (!this.voicesLive) this.mixer!.setFade(0, 0)
    this.voicesLive = true
    this.mixer!.fadeIn(FADE_IN_SECONDS)
    this.scheduleTimer(config)
    // Claim first, then describe: the metadata only displays once the system
    // has handed this page the now-playing session.
    //
    // `backgroundAudio` decides whether the element holds the session with the
    // real mix or with silence. With silence the system keeps a session alive
    // that contains nothing, which is what made switching apps stop the music
    // while the lock screen still claimed it was playing.
    void mediaRoute.claimNowPlaying(useSettings.getState().backgroundAudio).then(() => {
      // Pressing play is the other place a dead route shows up: the log from
      // the phone has a stop and a play right after the silence started, which
      // is a person trying to fix it by hand — and it did not help, because
      // starting a session again reuses whatever route is already there.
      if (this.playing) void mediaRoute.ensureRouteFlowing()
    })
    this.publishNowPlaying(config)
    mediaRoute.setPlaybackState('playing')
    this.emit()
  }

  /**
   * Tells the player card which journey day this session is, so the card can
   * name it. Republishes immediately when something is already playing —
   * journeys are started from a screen that loads the config first.
   */
  setJourneyContext(journey: { journeyId: string; day: number } | null) {
    this.journey = journey
    if (this.playing && this.config) this.publishNowPlaying(this.config)
  }

  /**
   * Feeds the lock screen, the headset controls and any device being cast to.
   *
   * A journey day leads with the journey's name, because that is what a person
   * glancing at a speaker wants to see; the frequencies move down to the second
   * line rather than disappearing. The cover is drawn to match — see `artwork`.
   */
  private publishNowPlaying(config: SessionConfig) {
    // The lock screen and any cast target follow the interface language too —
    // a device showing this card is showing it to the same person.
    const lang = useSettings.getState().lang
    const root = getFrequency(config.rootId)
    const beat = config.beatId ? getFrequency(config.beatId) : null
    const journey = this.journey ? getJourney(this.journey.journeyId) : null
    const day = this.journey?.day ?? 0
    const beatName = beat ? shortLabel(beat, lang) : null
    const beatLine = beatName
      ? `${config.beatHz} Hz · ${beatName}`
      : translate(lang, 'freq.rootTitle')

    const title = journey
      ? `${journeyTitle(journey, lang)} · ${translate(lang, 'common.stageN', { n: day })}`
      : root
        ? `${root.hz} Hz · ${freqLabel(root, lang)}`
        : 'Resona'
    const subtitle = journey && root ? `${root.hz} Hz · ${beatLine}` : beatLine

    mediaRoute.setMetadata(
      title,
      subtitle,
      coverArtwork({
        hue: root?.hue ?? 265,
        accentHue: journey ? THEME_HUE[themeOf(journey)] : (beat?.hue ?? root?.hue ?? 265),
        headline: root?.hz ? String(root.hz) : 'Resona',
        unit: root?.hz ? 'Hz' : undefined,
        caption: journey ? journeyTitle(journey, lang) : (root ? freqLabel(root, lang) : 'Resona'),
        footnote: journey
          ? translate(lang, 'common.stageOf', { n: day, total: journey.days })
          : (beatName ?? undefined),
      }),
    )
  }

  /** Live config update while playing — never restarts the audio. */
  applyConfig(config: SessionConfig, initial = false) {
    const prevTimer = this.config?.timerMode
    const prevCustom = this.config?.customMinutes
    this.config = config
    if (!this.mixer || !this.melody || !this.beat || !this.ambience) return

    const root = getFrequency(config.rootId)
    const rootHz = root?.hz ?? 528
    this.melody.setRoot(rootHz)
    this.melody.setDensity(config.density)
    this.melody.setPace(config.pace)
    this.melody.setDepth(config.depth)
    this.melody.setStyle(config.style ?? 'ambient')
    // Each engine sits at a different natural level; see OUTPUT_TRIM.
    engine.setOutputTrim(config.style ?? 'ambient')
    this.beat.setRoot(rootHz)
    this.beat.setBeatHz(config.beatHz)
    this.beat.setMode(config.beatMode)
    this.ambience.set(config.ambience)

    this.mixer.setLevel('melody', config.levels.melody)
    this.mixer.setLevel('beat', config.beatId ? config.levels.beat : 0)
    this.mixer.setLevel('ambience', config.levels.ambience)
    engine.setMasterVolume(config.levels.master)
    engine.setBassDb(config.bass ?? 0)

    if (this.playing) this.publishNowPlaying(config)

    // Changing the timer mid-session re-arms it from now.
    if (
      !initial &&
      this.playing &&
      (prevTimer !== config.timerMode || prevCustom !== config.customMinutes)
    ) {
      this.scheduleTimer(config)
      this.emit()
    }
  }

  private scheduleTimer(config: SessionConfig) {
    this.clearTimers()
    const minutes = resolveTimerMinutes(config)
    if (minutes === null) {
      this.endsAt = null
      return
    }
    const totalMs = minutes * 60_000
    this.endsAt = Date.now() + totalMs
    const fadeAt = Math.max(0, totalMs - FADE_OUT_SECONDS * 1000)
    this.fadeTimer = setTimeout(() => {
      this.mixer?.fadeOut(FADE_OUT_SECONDS)
      this.emit()
    }, fadeAt)
    this.stopTimer = setTimeout(() => this.stop(true), totalMs + 500)
  }

  private clearTimers() {
    if (this.fadeTimer) clearTimeout(this.fadeTimer)
    if (this.stopTimer) clearTimeout(this.stopTimer)
    this.fadeTimer = null
    this.stopTimer = null
  }

  /** True when the closing fade has begun — the UI dims to match. */
  isFadingOut(): boolean {
    const remaining = this.getRemainingSeconds()
    return remaining !== null && remaining <= FADE_OUT_SECONDS
  }

  /**
   * Manual stop still fades, just faster — a hard cut on a meditation app is
   * jarring enough that several competitors are criticised for it.
   *
   * The voices are torn down only after the fade has finished, and that delay
   * is why the generation counter exists. Pressing play again during the fade
   * used to start a new session that the old stop's timer then silenced a
   * second later: the clock ran, the pause button showed, and nothing came
   * out. Measured at 400 ms into the fade, output peaked at 0.0027 against
   * 0.082 before the pause. A superseded teardown must not touch the graph.
   */
  async stop(fromTimer = false) {
    if (!this.playing) return
    diag('stop', fromTimer ? 'timer' : 'user')
    const generation = ++this.generation
    this.clearTimers()
    const fade = fromTimer ? 0.4 : 2.5
    this.mixer?.fadeOut(fade)
    this.playing = false
    this.endsAt = null
    mediaRoute.releaseNowPlaying()
    mediaRoute.setPlaybackState('paused')
    this.emit()

    await new Promise((r) => setTimeout(r, fade * 1000 + 120))
    if (generation !== this.generation) return
    this.voicesLive = false
    this.melody?.stop()
    this.beat?.stop()
    this.ambience?.stop()
    this.emit()
  }

  /**
   * Rebuilds the running session in place.
   *
   * Not a stop and a play: those would fade out, tear down and fade back in
   * over twenty seconds, and would clear the timer and the journey context. The
   * voices are stopped and started against the current config while everything
   * around them stays exactly as it was.
   */
  private restartVoices() {
    if (!this.config) return
    diag('voices-rebuilt')
    this.melody?.stop()
    this.beat?.stop()
    this.ambience?.stop()
    this.melody?.start()
    this.beat?.start()
    this.ambience?.start()
    this.mixer?.setFade(1, 0.6)
    this.emit()
  }

  async toggle(config: SessionConfig) {
    if (this.playing) await this.stop()
    else await this.play(config)
  }

  /**
   * Wires the lock-screen buttons and the return-from-background path. Called
   * once at boot; `getConfig` is read lazily so the handlers always act on the
   * current session rather than a snapshot taken at registration time.
   */
  installSystemIntegration(getConfig: () => SessionConfig) {
    mediaRoute.setHandlers({
      onPlay: () => {
        if (!this.playing) void this.play(getConfig())
      },
      onPause: () => void this.stop(),
      onStop: () => void this.stop(),
    })

    // The route watches for its element being paused, and has to be able to
    // tell "the system took it" from "the person pressed stop".
    mediaRoute.isSessionActive = () => this.playing
    // Anything that takes the audio during a session raises the offer to
    // repair, at the moment it happens. It is never lowered by this code: no
    // measurement available here can tell whether sound is reaching the
    // speaker, and the last two reports were of repairs that said they had
    // worked. Only starting a session again, or the person dismissing it,
    // clears it.
    mediaRoute.watchOutputHealth(() => this.playing)
    mediaRoute.onFault = () => {
      if (this.playing) this.setSoundLost(true)
    }

    /**
     * Coming back from another app, and the escalation when coming back is not
     * enough.
     *
     * Resuming the context is the first step and usually the only one needed.
     * What it does not cover is a graph that survives the interruption in a
     * state where the transport runs and nothing sounds — the voices are
     * scheduled against a clock that stopped and restarted underneath them. The
     * app then shows a counting session with silence behind it, and the only
     * way out was to kill it and start again.
     *
     * So the return is verified rather than assumed: a moment after the context
     * is running, the output is measured, and if there is nothing there the
     * voices are rebuilt. That is precisely what relaunching the app achieved,
     * done automatically and without losing the session.
     */
    const recover = async () => {
      const running = await mediaRoute.resumeIfNeeded(this.playing)
      const interrupted = mediaRoute.consumeInterrupted()
      if (!running || !this.playing) return

      /**
       * The route is checked on every return, not only after an interruption
       * the context noticed.
       *
       * The first version of this was gated on `interrupted`, and a log from a
       * real phone showed why that was wrong: a call came in during a session,
       * and the context was never interrupted at all — nothing was recorded,
       * because with background audio on the graph renders into a MediaStream
       * rather than to the speaker, so the system has no reason to touch it.
       * What it takes is the element. The graph then keeps producing sound
       * that goes nowhere, which is exactly what "playing, but silent" is.
       *
       * `ensureRouteFlowing` costs nothing when the route is healthy — it looks
       * at the element and the track — and repairs it when it is not.
       */
      if (mediaRoute.isExternal) {
        let ok = await mediaRoute.ensureRouteFlowing(interrupted)
        if (!ok) {
          // One failed attempt is not a verdict. Repairs are rate-limited so
          // they cannot become a loop, which means a second fault arriving
          // moments after the first is refused rather than fixed — and in the
          // measurements that produced a "sound lost" notice on a route that
          // then repaired itself a second later. The person must not be told
          // the sound is gone while the app is still getting it back.
          await new Promise((r) => setTimeout(r, 1400))
          ok = await mediaRoute.ensureRouteFlowing()
        }
        if (!ok) this.setSoundLost(true)
      }

      // Long enough for a resumed graph to be producing something again, short
      // enough not to be noticed if it is.
      await new Promise((r) => setTimeout(r, 900))
      if (this.playing && !engine.isProducingSound()) {
        // The interesting line in the whole log: the context came back and the
        // graph did not, which is the fault that used to require relaunching.
        diag('silent-after-resume')
        this.restartVoices()
      }
    }

    document.addEventListener('visibilitychange', () => {
      // Recorded on both edges. A log that shows a session playing and then
      // nothing cannot distinguish "the app was never left" from "the app was
      // left and something took the sound" — and the second report to arrive
      // was exactly that shape: two lines, and a switch to another app in
      // between that left no trace.
      if (this.playing) diag(document.visibilityState === 'visible' ? 'foreground' : 'background')
      if (document.visibilityState === 'visible') void recover()
    })
    // `pageshow` fires on a back-forward-cache restore, where `visibilitychange`
    // does not.
    window.addEventListener('pageshow', () => void recover())
    // An interruption that arrives while the page is still in front — a call, or
    // another app taking the audio session — is never a visibility change.
    mediaRoute.watchContextState(() => {
      if (this.playing) void recover()
    })
    mediaRoute.onRecovered = () => void recover()

    // The lock-screen card is written once per config change, so switching
    // language mid-session would otherwise leave the old language showing on a
    // phone or a speaker until something else happened to touch the config.
    useSettings.subscribe((state, prev) => {
      if (state.lang !== prev.lang && this.playing && this.config) {
        this.publishNowPlaying(this.config)
      }
    })
  }
}

export const player = new SessionPlayer()
