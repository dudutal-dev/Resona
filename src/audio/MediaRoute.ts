import { diag } from '../lib/diagnostics'
import { Tone, engine } from './ToneEngine'

/**
 * Everything to do with where the sound goes and who controls it.
 *
 * Three separate concerns, all of them constrained by what browsers actually
 * allow rather than by what would be convenient:
 *
 * 1. **Lock-screen / headset controls** via the Media Session API. Widely
 *    supported and cheap, so it is always on while playing.
 *
 * 2. **Now-playing attribution and AirPlay**, both of which need the audio to
 *    reach the system through an HTMLMediaElement. There is exactly ONE such
 *    element here, and that is load-bearing: two of them compete for the same
 *    playback session, and on iOS the route follows the wrong one — which is
 *    how adding a separate silent element for attribution silenced casting.
 *
 * 3. **Screen wake lock**, so a session left running on a nightstand is not cut
 *    short by the screen turning off.
 *
 * On background playback: for a long time the element here held a *silent*
 * loop while the synthesised audio went straight to the speakers. That is the
 * worst of both worlds — the system sees media playing, shows the card, and
 * keeps the session alive, while the thing it is keeping alive is two seconds
 * of silence and the actual music is on a path the OS suspends the moment the
 * page stops being frontmost. So the live master is now routed *through* the
 * element by default: the same MediaStream path that casting already used and
 * that was already proven to carry real audio. It is the only mechanism a web
 * page is given, and `resumeIfNeeded` still covers the case where the platform
 * suspends anyway.
 */

type SessionHandlers = {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

/**
 * A short run of silence as a real WAV, built at runtime so nothing has to be
 * fetched and the single-file build stays self-contained. 8-bit PCM encodes
 * silence as 128, not 0.
 */
function silentWavUrl(seconds = 2): string {
  const rate = 8000
  const samples = rate * seconds
  const buf = new ArrayBuffer(44 + samples)
  const view = new DataView(buf)
  const ascii = (offset: string | number, text?: string) => {
    const [o, t] = typeof offset === 'number' ? [offset, text!] : [0, offset]
    for (let i = 0; i < t.length; i++) view.setUint8(o + i, t.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true) // byte rate
  view.setUint16(32, 1, true) // block align
  view.setUint16(34, 8, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, samples, true)
  new Uint8Array(buf, 44).fill(128)
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
}

/** Safari-only, and still prefixed. */
type AirPlayElement = HTMLAudioElement & {
  webkitShowPlaybackTargetPicker?: () => void
}

class MediaRoute {
  private wakeLock: WakeLockSentinel | null = null
  private wantWakeLock = false
  private el: AirPlayElement | null = null
  private external = false
  private streamDest: MediaStreamAudioDestinationNode | null = null
  private stallHandlers: {
    ended: (e: Event) => void
    error: (e: Event) => void
    pause: () => void
  } | null = null
  private gestureRetryArmed = false
  private streamProbe: AnalyserNode | null = null
  private silentUrl: string | null = null
  /**
   * Set when the context stops on its own — a call, another app taking the
   * audio session. Read and cleared by the recovery path, which needs to know
   * whether it is returning from an interruption or merely from an app switch.
   */
  private interrupted = false
  /**
   * Whether `currentTime` on this browser's media element advances while a
   * MediaStream plays through it.
   *
   * Measured rather than assumed, on a route that has just been verified: if it
   * advances there, a frozen clock later is real evidence the route has died.
   * If it does not advance even on a working route, the signal is useless on
   * this device and is never consulted again — an unreliable test that triggers
   * a repair is worse than no test at all.
   */
  private timeAdvances: boolean | null = null
  /** Repairs are rate-limited; a broken route must not become a rebuild loop. */
  private lastRebuild = 0
  /**
   * Something took the audio while the app was away.
   *
   * Kept because the repair cannot be verified. Every signal available here —
   * the element playing, the track live, the clock moving — said the route was
   * healthy on a phone that was producing no sound at all, so a fault seen on
   * the way out is the only honest reason to suspect the sound on the way back.
   */
  private faultSeen = false
  /**
   * Whether a session is supposed to be running, asked by the element's own
   * `pause` event — which fires both when the system takes the audio away and
   * when this app pauses the element itself.
   */
  isSessionActive: (() => boolean) | null = null
  /**
   * Called the moment anything takes the audio, rather than at the end of a
   * repair.
   *
   * The first version worked this out inside the recovery path, from a flag and
   * a return value, and it lost the race: the element's `pause` event arrives
   * after the return to the foreground has already been handled, so the fault
   * was recorded a moment after the decision that needed it. Reporting it where
   * it happens has no ordering to get wrong.
   */
  onFault: (() => void) | null = null

  // ------------------------------------------------ the single media element

  /**
   * One element, two jobs.
   *
   * iOS hands the Now Playing session — the lock-screen card and the name shown
   * at a playback target — only to a page with a media element actually
   * playing, and AirPlay likewise can only be offered on a media element. Both
   * needs are served here by the same `<audio>`, because a second one would
   * contend for the session and the cast route would follow whichever won.
   *
   * Its source switches with the mode:
   *   - idle:  a looping near-silence, enough to hold the session so the system
   *            shows this app's name instead of the last media app's.
   *   - cast:  the live master, piped through a MediaStream, so what the remote
   *            speaker plays is the actual session.
   */
  private element(): AirPlayElement {
    if (!this.el) {
      const el = document.createElement('audio') as AirPlayElement
      // `loop` is set per source, not here. It belongs to the silent holder and
      // is actively wrong for the live stream — see `setExternal`.
      el.setAttribute('playsinline', '')
      el.style.display = 'none'
      document.body.appendChild(el)
      this.el = el
    }
    return this.el
  }

  // ---------------------------------------------------------------- routing

  get isExternal() {
    return this.external
  }

  /** Safari exposes the picker; other browsers leave routing to the OS. */
  canPickOutputDevice(): boolean {
    if (typeof document === 'undefined') return false
    const probe = document.createElement('audio') as AirPlayElement
    return typeof probe.webkitShowPlaybackTargetPicker === 'function'
  }

  /**
   * Moves the master onto the media element, or back to the speakers.
   *
   * The previous attempt trusted `play()` resolving as proof that audio was
   * flowing. It is not — it resolves for a stream that renders nothing, and
   * because the direct path had already been torn down, the app went silent
   * with no error to catch. So the signal is measured before committing, and
   * anything short of real audio puts the direct path straight back.
   */
  async setExternal(enabled: boolean, settleMs = 350): Promise<boolean> {
    if (!engine.isStarted) return this.external
    if (enabled === this.external) return this.external

    const limiter = engine.output
    const ctx = Tone.getContext().rawContext as unknown as AudioContext
    const el = this.element()

    if (!enabled) {
      this.clearStallWatch()
      limiter.disconnect()
      limiter.toDestination()
      this.external = false
      // Back to holding the session with silence rather than the live mix.
      await this.playSilence()
      return false
    }

    if (!this.streamDest) {
      this.streamDest = ctx.createMediaStreamDestination()
      this.streamProbe = ctx.createAnalyser()
      this.streamProbe.fftSize = 2048
      limiter.connect(this.streamProbe)
    }

    limiter.disconnect()
    limiter.connect(this.streamDest)
    if (this.streamProbe) limiter.connect(this.streamProbe)

    el.pause()
    el.removeAttribute('src')
    /**
     * Never loop a live stream.
     *
     * This element is also the one that holds the now-playing session with two
     * seconds of silence, which has to loop or the session lapses — and `loop`
     * used to be set once when the element was created and never cleared. A
     * MediaStream has no end to loop at, so on the phone's own output that was
     * merely meaningless. On a remote speaker it is not: the receiver is fed
     * from this element, and if the stream ever stalls long enough for the
     * element to consider itself finished, `loop` sends it back to the start of
     * what it has and plays that again — a chunk of the tone repeating over the
     * live melody, which is exactly what a stuck cast sounds like.
     */
    el.loop = false
    el.srcObject = this.streamDest.stream
    el.volume = 1

    const ok = await this.startAndVerify(el, settleMs)
    diag(ok ? 'route-external' : 'route-external-failed')
    if (!ok) {
      limiter.disconnect()
      limiter.toDestination()
      el.srcObject = null
      await this.playSilence()
      this.external = false
      return false
    }

    // A live stream has no end and should never stall for long. If it does, the
    // route is broken in a way the element cannot report — so rather than let it
    // sit there feeding a receiver whatever it has, fall back to the phone's own
    // output. Silence that recovers beats a tone repeating over the music.
    this.watchExternalStall(el)

    this.external = true
    await this.calibrateClock(el)
    return true
  }

  private watchExternalStall(el: HTMLMediaElement) {
    this.clearStallWatch()
    const recover = (e: Event) => {
      if (!this.external) return
      diag('route-stalled', e.type)
      void this.setExternal(false)
    }
    // The element being paused is the loudest thing the system does on a phone
    // call, and it was the one event nobody was listening for. Acted on only
    // while a session is supposed to be running: the app pauses this element
    // itself on every stop, and repairing that would be fighting the person who
    // pressed stop.
    const paused = () => {
      if (!this.external || !this.isSessionActive?.()) return
      diag('element-paused')
      this.reportFault()
      void this.ensureRouteFlowing()
    }
    this.stallHandlers = { ended: recover, error: recover, pause: paused }
    el.addEventListener('ended', recover)
    el.addEventListener('error', recover)
    el.addEventListener('pause', paused)
  }

  private clearStallWatch() {
    if (!this.el || !this.stallHandlers) return
    this.el.removeEventListener('ended', this.stallHandlers.ended)
    this.el.removeEventListener('error', this.stallHandlers.error)
    this.el.removeEventListener('pause', this.stallHandlers.pause)
    this.stallHandlers = null
  }

  /** Plays, then confirms the element is really running on a live signal. */
  private async startAndVerify(el: HTMLMediaElement, settleMs: number): Promise<boolean> {
    try {
      await el.play()
    } catch {
      return false
    }
    // Give the element a moment to actually start rendering. A session opening
    // on an 18-second fade needs longer than a cast switched on mid-track, or
    // the measurement lands in the part of the fade that is still silence and
    // the route gets rejected for working correctly.
    await new Promise((r) => setTimeout(r, settleMs))
    if (el.paused || el.ended) return false
    return this.streamHasSignal()
  }

  /** True when the graph is producing a non-silent signal right now. */
  private streamHasSignal(): boolean {
    if (!this.streamProbe) return true
    const buf = new Float32Array(this.streamProbe.fftSize)
    this.streamProbe.getFloatTimeDomainData(buf)
    let peak = 0
    for (const v of buf) peak = Math.max(peak, Math.abs(v))
    // The session fades in, so this only has to clear the noise floor.
    return peak > 0.0005
  }

  private async playSilence() {
    const el = this.element()
    el.srcObject = null
    // Two seconds of silence has to repeat, or the session it is holding lapses.
    el.loop = true
    if (!this.silentUrl) this.silentUrl = silentWavUrl()
    if (el.getAttribute('src') !== this.silentUrl) el.src = this.silentUrl
    // Not muted: a muted element does not count as playing media, which is the
    // entire point of holding it.
    el.volume = 0.001
    try {
      await el.play()
    } catch {
      /* needs a gesture; playback itself is unaffected */
    }
  }

  // ------------------------------------------------------------ video route
  //
  // Not here, and the reason is worth keeping — it is also what showed where
  // the route does belong.
  //
  // The idea was sound on paper: the audio route already hands AirPlay a
  // MediaStream, `canvas.captureStream()` produces a video track of the same
  // kind, so combining them on a `<video>` element should send the picture and
  // the sound together and leave the phone free. Safari accepted the element and
  // played it, so nothing here could tell that it had not worked.
  //
  // On the television it plainly had not. AirPlay took the audio track and
  // ignored the video one, so the screen showed the Now Playing card — a square
  // with the artwork and the title — while the music played; and disconnecting
  // left the receiver stuck, because the canvas capture track was still running
  // into a stream whose element had been torn out from under it.
  //
  // AirPlay carries a media *source*, not an arbitrary MediaStream, and no
  // amount of arranging tracks changes that. That sentence is exact, and when
  // the figure stopped being a canvas and became a real file it stopped being a
  // wall: a `<video>` with a URL is precisely the kind of thing AirPlay does
  // carry. So there is a video route now, and it lives in `lib/remoteVideo`
  // with the stage that owns the element rather than here with the audio —
  // what it sends is a clip, not a mix, and it has nothing to do with this
  // class's one-element rule. Screen Mirroring remains the other way, and the
  // one that also carries the canvas treatment and the sound.

  /** Opens Safari's AirPlay picker, switching to the castable route first. */
  async showOutputPicker(): Promise<boolean> {
    if (!this.canPickOutputDevice()) return false
    if (!this.external && !(await this.setExternal(true))) return false
    this.el?.webkitShowPlaybackTargetPicker?.()
    return true
  }

  // ------------------------------------------------------- now-playing claim

  /**
   * Takes the Now Playing session so the system shows this app's name.
   *
   * `live` asks for the real mix to go through the element rather than a silent
   * placeholder, which is what gives the session any chance of surviving a
   * switch to another app. It is verified and falls back to the direct path, so
   * the worst case is the behaviour this app had before.
   */
  async claimNowPlaying(live = false) {
    // The element is paused on every stop, and the route survives it — so a
    // second session finds `external` already true with a paused element
    // underneath. This used to return early on exactly that state, which left
    // the live mix routed into something that was not playing: full level at
    // the limiter, a running clock, a moving orb, and silence. Whatever the
    // route is, the element has to be started again.
    if (this.external) {
      try {
        await this.el?.play()
      } catch {
        /* needs a gesture; the direct fallback below is not reachable here */
      }
      return
    }
    await this.playSilence()
    if (live) await this.setExternal(true, 1400)
  }

  releaseNowPlaying() {
    this.el?.pause()
  }

  // ---------------------------------------------------- lock-screen controls

  /**
   * `artwork` is what the player draws next to the name. The app icon is kept
   * at the end of the list as a fallback for a browser that refuses the drawn
   * cover; it resolves only in the hosted build, which is exactly where a
   * fallback would be needed.
   */
  setMetadata(title: string, subtitle: string, artwork: MediaImage[] = []) {
    if (!('mediaSession' in navigator)) return
    const MD = (window as unknown as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata
    if (!MD) return
    navigator.mediaSession.metadata = new MD({
      title,
      artist: subtitle,
      album: 'Resona',
      artwork: [
        ...artwork,
        { src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    })
  }

  setHandlers(h: SessionHandlers) {
    if (!('mediaSession' in navigator)) return
    const set = (action: MediaSessionAction, fn: () => void) => {
      try {
        navigator.mediaSession.setActionHandler(action, fn)
      } catch {
        // Not every action is supported on every browser; ignore the rest.
      }
    }
    set('play', h.onPlay)
    set('pause', h.onPause)
    set('stop', h.onStop)
  }

  setPlaybackState(state: 'playing' | 'paused' | 'none') {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state
  }

  // --------------------------------------------------------------- wake lock

  /**
   * Keeps the screen on during a session. Supported on iOS 16.4+ and most
   * desktop browsers; silently does nothing elsewhere.
   */
  async setWakeLock(want: boolean): Promise<boolean> {
    this.wantWakeLock = want
    if (!want) {
      await this.releaseWakeLock()
      return false
    }
    await this.acquireWakeLock()
    return this.wakeLock !== null
  }

  /** Whether a lock is actually held right now, not merely wanted. */
  get hasWakeLock() {
    return this.wakeLock !== null
  }

  get supportsWakeLock() {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator
  }

  private async acquireWakeLock() {
    if (this.wakeLock || !('wakeLock' in navigator)) return
    try {
      this.wakeLock = await navigator.wakeLock.request('screen')
      // The OS drops the lock whenever the page is hidden, so it has to be
      // taken again on return.
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null
      })
    } catch {
      this.wakeLock = null
    }
  }

  private async releaseWakeLock() {
    try {
      await this.wakeLock?.release()
    } catch {
      /* already gone */
    }
    this.wakeLock = null
  }

  /**
   * Called when the page becomes visible again, and whenever the context
   * reports that it has stopped running.
   *
   * The previous version tried `resume()` once and gave up. That is why
   * switching to another app and coming back could leave the transport showing
   * a running clock with nothing audible, recoverable only by killing the app:
   * three separate things can go wrong on the way back and it only handled the
   * first.
   *
   *  - iOS has a state the spec does not: `interrupted`. A phone call, another
   *    app taking the audio session, or the screen locking puts the context
   *    there, and a single `resume()` from `interrupted` frequently resolves
   *    without the context actually leaving that state. It has to be asked more
   *    than once.
   *  - `resume()` can require a fresh user gesture, and the promise rejects
   *    silently. Nothing was listening for the next tap, so the app stayed dead
   *    until it was relaunched — the next tap is exactly the gesture it needed.
   *  - The element carrying the now-playing session is paused by some platforms
   *    when the page hides, and starting it again is what re-establishes the
   *    route.
   *
   * Returns whether the context is running by the end, so the caller can decide
   * whether anything further is needed.
   */
  async resumeIfNeeded(shouldBePlaying: boolean): Promise<boolean> {
    if (!shouldBePlaying) {
      await this.releaseWakeLock()
      return Tone.getContext().state === 'running'
    }

    // Only worth a line if something was actually wrong. Coming back to a
    // context that never stopped happens every time the app is switched to, and
    // a log full of that hides the one entry that matters.
    const wasRunning = (Tone.getContext().state as string) === 'running'
    if (!wasRunning) this.interrupted = true
    const running = await this.forceResume()
    if (!wasRunning) diag(running ? 'resumed' : 'resume-failed', Tone.getContext().state)
    if (this.wantWakeLock) await this.acquireWakeLock()
    // Whether the element had to be started again is worth a line. It is the
    // quiet repair — the one that fixes a session paused by the system without
    // anything else noticing — and a repair that leaves no trace is a repair
    // nobody can confirm happened when the next report arrives.
    const wasPaused = !!this.el?.paused
    try {
      await this.el?.play()
    } catch {
      /* needs a gesture; `armGestureRetry` below covers it */
    }
    if (wasPaused && this.el && !this.el.paused) diag('element-restarted')
    if (!running) this.armGestureRetry()
    return running
  }

  /**
   * Asks the context to resume, more than once, because once is not enough.
   *
   * The state is re-read through a function on every check rather than held in
   * a local: it changes underneath us, which is the entire point, and a
   * narrowed local would be describing a moment that has already passed.
   */
  private async forceResume(attempts = 3): Promise<boolean> {
    const isRunning = () => (Tone.getContext().state as string) === 'running'
    for (let i = 0; i < attempts; i++) {
      if (isRunning()) return true
      try {
        await Tone.getContext().resume()
      } catch {
        /* try again, or fall through to the gesture retry */
      }
      // A resolved `resume()` does not mean a running context on iOS.
      if (isRunning()) return true
      await new Promise((r) => setTimeout(r, 120))
    }
    return isRunning()
  }

  /**
   * Waits for the next touch anywhere and tries again.
   *
   * This is the piece that was missing. A context that needs a gesture cannot
   * be revived by any amount of code, but the person is holding the phone and
   * about to tap something — so the tap that used to do nothing now does the
   * one thing that works.
   */
  private armGestureRetry() {
    if (this.gestureRetryArmed) return
    this.gestureRetryArmed = true
    diag('awaiting-gesture')
    const retry = async () => {
      const ok = await this.forceResume(1)
      try {
        await this.el?.play()
      } catch {
        /* still not allowed */
      }
      if (ok) {
        diag('recovered-by-gesture')
        this.gestureRetryArmed = false
        for (const type of GESTURES) document.removeEventListener(type, retry)
        this.onRecovered?.()
      }
    }
    for (const type of GESTURES) {
      document.addEventListener(type, retry, { passive: true })
    }
  }

  /** Called after a gesture brings the context back, so the graph can be checked. */
  onRecovered: (() => void) | null = null

  /**
   * Is sound actually leaving through the route, right now?
   *
   * The question this answers is the one the whole recovery path was missing.
   * Everything else here measured the audio *graph*, and a report from a real
   * phone settled it: a call came in, the graph was never interrupted at all —
   * no state change, nothing in the log — and the app played silence until it
   * was relaunched. Of course it did. With background audio on, the graph
   * renders into a MediaStream rather than to the speaker, so the system has no
   * reason to interrupt it; what it takes away is the *element*, and the
   * element is downstream of every measurement that was being taken.
   *
   * Three signals, in order of how much they can be trusted:
   *  - the element paused, which is unambiguous;
   *  - the stream's track ended or went mute, which cannot be undone;
   *  - the element's clock frozen, which is only consulted where it has been
   *    shown to move on a working route.
   */
  private async routeIsFlowing(): Promise<boolean> {
    if (!this.external) return true
    const el = this.el
    if (!el) return false
    if (el.paused || el.ended) {
      this.reportFault()
      diag('route-not-flowing', 'paused')
      return false
    }
    const track = this.streamDest?.stream.getAudioTracks()[0]
    if (!track || track.readyState !== 'live' || track.muted) {
      this.reportFault()
      diag('route-not-flowing', track ? `track ${track.readyState}${track.muted ? ' muted' : ''}` : 'no track')
      return false
    }
    if (this.timeAdvances) {
      const at = el.currentTime
      await new Promise((r) => setTimeout(r, 450))
      if (el.currentTime <= at) {
          this.reportFault()
        diag('route-not-flowing', 'clock frozen')
        return false
      }
    }
    return true
  }

  /**
   * Checks the route and repairs it if it has died.
   *
   * Called on every return to the app while a session is running — not only
   * after an interruption the context noticed, because the fault that prompted
   * this never reached the context.
   */
  async ensureRouteFlowing(force = false): Promise<boolean> {
    if (!this.external || !engine.isStarted) return true
    // `force` is used after an interruption the context did notice: the element
    // may look perfectly healthy and still be attached to a session the system
    // has taken away, and a person who has just finished a phone call will not
    // begrudge half a second of silence.
    if (!force && (await this.routeIsFlowing())) return true

    // A route that cannot be fixed must not be retried every second. The gap
    // is generous: a genuine second fault within five seconds is indis-
    // tinguishable from a loop, and the loop is the worse outcome.
    const now = Date.now()
    if (now - this.lastRebuild < 5000) return false
    this.lastRebuild = now

    // Starting the element again is the cheap repair, and where the system
    // simply paused it, the only one needed.
    try {
      await this.el?.play()
    } catch {
      /* needs a gesture, or the element is beyond starting */
    }
    if (await this.routeIsFlowing()) {
      diag('route-resumed')
      return true
    }
    return this.rebuildExternalRoute()
  }

  /**
   * Finds out whether the element's clock can be believed on this browser.
   *
   * Run on a route that has just been verified as carrying sound, so whatever
   * it observes is the behaviour of a *working* route. A clock that does not
   * move here would produce a false alarm every time it were consulted.
   */
  private async calibrateClock(el: HTMLMediaElement) {
    if (this.timeAdvances !== null) return
    const at = el.currentTime
    await new Promise((r) => setTimeout(r, 450))
    this.timeAdvances = el.currentTime > at
  }

  /**
   * Whether the last stop was an interruption rather than an app switch, read
   * once and cleared.
   *
   * The distinction matters because the repair below is not free: it costs a
   * short gap in the audio, which would be absurd on every switch to another
   * app and is nothing at all after a phone call.
   */
  consumeInterrupted(): boolean {
    const was = this.interrupted
    this.interrupted = false
    return was
  }

  private reportFault() {
    this.faultSeen = true
    this.onFault?.()
  }

  /** Whether anything took the audio since this was last asked. */
  consumeFaultSeen(): boolean {
    const was = this.faultSeen
    this.faultSeen = false
    return was
  }

  /**
   * Throws the element away and builds a new one.
   *
   * The step above this — starting the element again — reported success on a
   * phone that stayed silent, and every measurement agreed with it. Which means
   * the element can hold a playback session the system has emptied while
   * presenting as perfectly healthy, and nothing in a page can see the
   * difference. What relaunching the app does that no repair had done is
   * discard the element itself, so that is what this does.
   */
  async hardRebuild(): Promise<boolean> {
    if (!engine.isStarted) return false
    diag('hard-rebuild')
    this.clearStallWatch()
    const old = this.el
    if (old) {
      try {
        old.pause()
        old.srcObject = null
        old.removeAttribute('src')
        old.remove()
      } catch {
        /* it is being discarded either way */
      }
    }
    this.el = null
    this.timeAdvances = null

    for (const track of this.streamDest?.stream.getTracks() ?? []) track.stop()
    try {
      this.streamDest?.disconnect()
      this.streamProbe?.disconnect()
    } catch {
      /* already detached */
    }
    this.streamDest = null
    this.streamProbe = null
    this.external = false
    // A fresh element, a fresh stream, from the same code path a first session
    // uses — the closest thing to relaunching without losing the session.
    return this.setExternal(true, 700)
  }

  /**
   * Takes the element out of the path entirely.
   *
   * The last resort, and the one most likely to make a sound: with the master
   * connected straight to the destination there is no stream, no element and no
   * playback session to lose. Background playback and the lock-screen card go
   * with it, which is a real cost and a much smaller one than silence.
   */
  async toDirect(): Promise<void> {
    if (!engine.isStarted) return
    diag('route-direct')
    this.clearStallWatch()
    for (const track of this.streamDest?.stream.getTracks() ?? []) track.stop()
    const limiter = engine.output
    limiter.disconnect()
    limiter.toDestination()
    this.streamDest = null
    this.streamProbe = null
    this.external = false
    if (this.el) {
      this.el.srcObject = null
      this.el.pause()
    }
  }

  /**
   * Builds a completely new route to the media element.
   *
   * This is the fix for the fault that survived everything above: after a phone
   * call the app comes back looking correct — the clock runs, the visualiser
   * moves, the graph is measurably producing sound — and nothing comes out. The
   * reason is that "producing sound" was measured at the *graph*, and when the
   * route is a MediaStream feeding an `<audio>` element, a live graph proves
   * nothing about it. iOS ends the stream's track over an interruption, and an
   * ended track cannot be restarted: `play()` resolves, the element reports
   * itself as playing, and it renders silence for ever. Relaunching the app
   * worked because it built a new element and a new stream — which is precisely
   * what this does, without losing the session.
   *
   * If the new route cannot be verified, the direct path is restored instead,
   * so the worst outcome is sound from the phone rather than no sound at all.
   */
  async rebuildExternalRoute(): Promise<boolean> {
    if (!engine.isStarted || !this.external) return false
    const limiter = engine.output
    const ctx = Tone.getContext().rawContext as unknown as AudioContext
    const el = this.element()

    this.clearStallWatch()
    // The old destination is discarded rather than reused. Its track is the
    // thing that died.
    for (const track of this.streamDest?.stream.getTracks() ?? []) track.stop()
    try {
      this.streamDest?.disconnect()
      this.streamProbe?.disconnect()
    } catch {
      /* already detached */
    }
    limiter.disconnect()

    this.streamDest = ctx.createMediaStreamDestination()
    this.streamProbe = ctx.createAnalyser()
    this.streamProbe.fftSize = 2048
    limiter.connect(this.streamDest)
    limiter.connect(this.streamProbe)

    el.pause()
    el.removeAttribute('src')
    el.loop = false
    el.srcObject = this.streamDest.stream
    el.volume = 1

    if (await this.startAndVerify(el, 500)) {
      this.watchExternalStall(el)
      await this.calibrateClock(el)
      diag('route-rebuilt')
      return true
    }

    limiter.disconnect()
    limiter.toDestination()
    el.srcObject = null
    this.external = false
    await this.playSilence()
    diag('route-fallback-direct')
    return false
  }

  /**
   * Fires whenever the context leaves `running` on its own — an interruption
   * that arrives while the page is still in front, which `visibilitychange`
   * never hears about.
   */
  watchContextState(onLost: () => void) {
    const raw = Tone.getContext().rawContext as unknown as AudioContext
    raw.addEventListener?.('statechange', () => {
      // The loss is the event; the return is already recorded by `resumeIfNeeded`
      // as `resumed`, and logging both doubles every interruption.
      if (raw.state !== 'running') {
        this.interrupted = true
        this.reportFault()
        diag('context-lost', raw.state)
        onLost()
      }
    })
  }
}

/** Anything that counts as a gesture on the platforms this runs on. */
const GESTURES = ['pointerdown', 'touchend', 'keydown'] as const

export const mediaRoute = new MediaRoute()
