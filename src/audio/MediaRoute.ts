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
  private streamProbe: AnalyserNode | null = null
  private silentUrl: string | null = null

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
      el.loop = true
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
    el.srcObject = this.streamDest.stream
    el.volume = 1

    const ok = await this.startAndVerify(el, settleMs)
    if (!ok) {
      limiter.disconnect()
      limiter.toDestination()
      el.srcObject = null
      await this.playSilence()
      this.external = false
      return false
    }

    this.external = true
    return true
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
  // There isn't one, and this note is here so it is not attempted a third time.
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
  // amount of arranging tracks changes that. What does put this picture on a
  // television is Screen Mirroring, which is a system feature and needs nothing
  // from the app beyond a full-screen canvas — so that is what TV mode now says
  // to do.

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
    if (this.external) return
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
   * Called when the page becomes visible again. Browsers suspend the
   * AudioContext in the background — this makes the return silent-free — and
   * re-takes the wake lock the OS dropped.
   */
  async resumeIfNeeded(shouldBePlaying: boolean) {
    if (shouldBePlaying) {
      if (Tone.getContext().state !== 'running') {
        try {
          await Tone.getContext().resume()
        } catch {
          /* needs a fresh gesture; the UI still shows the play control */
        }
      }
      if (this.wantWakeLock) await this.acquireWakeLock()
      // The element is paused when the page hides on some platforms.
      try {
        await this.el?.play()
      } catch {
        /* needs a gesture */
      }
    } else {
      await this.releaseWakeLock()
    }
  }
}

export const mediaRoute = new MediaRoute()
