import { engine } from './ToneEngine'
import { Mixer } from './Mixer'
import { GenerativeMelody } from './GenerativeMelody'
import { BinauralGenerator } from './BinauralGenerator'
import { Ambience, BUILTIN_AMBIENCE, type AmbienceOption } from './Ambience'
import { mediaRoute } from './MediaRoute'
import { coverArtwork } from './artwork'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
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
    this.startedAt = Date.now()
    // Only drop to silence when the voices really were torn down. Resuming
    // during a fade-out leaves them running, and slamming the fade to zero
    // first would put an audible hole in a session that never stopped.
    if (!this.voicesLive) this.mixer!.setFade(0, 0)
    this.voicesLive = true
    this.mixer!.fadeIn(FADE_IN_SECONDS)
    this.scheduleTimer(config)
    // Claim first, then describe: the metadata only displays once the system
    // has handed this page the now-playing session.
    void mediaRoute.claimNowPlaying()
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
      ? `${journeyTitle(journey, lang)} · ${translate(lang, 'common.dayN', { n: day })}`
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
          ? translate(lang, 'common.dayOf', { n: day, total: journey.days })
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
    this.beat.setRoot(rootHz)
    this.beat.setBeatHz(config.beatHz)
    this.beat.setMode(config.beatMode)
    this.ambience.set(config.ambience)

    this.mixer.setLevel('melody', config.levels.melody)
    this.mixer.setLevel('beat', config.beatId ? config.levels.beat : 0)
    this.mixer.setLevel('ambience', config.levels.ambience)
    engine.setMasterVolume(config.levels.master)

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

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void mediaRoute.resumeIfNeeded(this.playing)
    })

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
