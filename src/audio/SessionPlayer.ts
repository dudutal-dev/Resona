import { engine } from './ToneEngine'
import { Mixer } from './Mixer'
import { GenerativeMelody } from './GenerativeMelody'
import { BinauralGenerator } from './BinauralGenerator'
import { Ambience, BUILTIN_AMBIENCE, type AmbienceOption } from './Ambience'
import { mediaRoute } from './MediaRoute'
import { getFrequency } from '../lib/catalog'
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

export const TIMER_LABEL: Record<TimerMode, string> = {
  '15': '15 דקות',
  '30': '30 דקות',
  '60': 'שעה',
  '120': 'שעתיים',
  untilMorning: 'עד הבוקר',
  unlimited: 'ללא הגבלה',
  custom: 'מותאם',
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
    await this.ensureGraph()
    this.config = config
    this.clearTimers()

    this.applyConfig(config, true)

    this.melody!.start()
    this.beat!.start()
    this.ambience!.start()

    this.playing = true
    this.startedAt = Date.now()
    this.mixer!.setFade(0, 0)
    this.mixer!.fadeIn(FADE_IN_SECONDS)
    this.scheduleTimer(config)
    this.publishNowPlaying(config)
    mediaRoute.setPlaybackState('playing')
    this.emit()
  }

  /** Feeds the lock screen and headset controls. */
  private publishNowPlaying(config: SessionConfig) {
    const root = getFrequency(config.rootId)
    const beat = config.beatId ? getFrequency(config.beatId) : null
    const title = root ? `${root.hz} Hz · ${root.label}` : 'Resona'
    const subtitle = beat ? `${config.beatHz} Hz · ${beat.label.split('—')[0].trim()}` : 'תדר יסוד'
    mediaRoute.setMetadata(title, subtitle)
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
   */
  async stop(fromTimer = false) {
    if (!this.playing) return
    this.clearTimers()
    const fade = fromTimer ? 0.4 : 2.5
    this.mixer?.fadeOut(fade)
    this.playing = false
    this.endsAt = null
    mediaRoute.setPlaybackState('paused')
    this.emit()

    await new Promise((r) => setTimeout(r, fade * 1000 + 120))
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
  }
}

export const player = new SessionPlayer()
