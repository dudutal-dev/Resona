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
 * 2. **External output (AirPlay).** A raw Web Audio graph cannot be handed to
 *    AirPlay — only an HTMLMediaElement can. So the master is re-routed through
 *    a MediaStream into an <audio> element, which then exposes Safari's
 *    playback-target picker. This is a mode, not a parallel tap: connecting
 *    both paths at once would play everything twice.
 *
 * 3. **Screen wake lock**, so a session left running on a nightstand is not cut
 *    short by the screen turning off.
 *
 * What is deliberately NOT here: a trick to keep synthesised audio running
 * after the user leaves the tab on iOS. Safari suspends the AudioContext when
 * the page is backgrounded and offers web pages no way to opt out. Rather than
 * ship a hack that half-works, `resumeIfNeeded` makes coming back seamless.
 */

type SessionHandlers = {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

/** Safari-only, and still prefixed. */
type AirPlayElement = HTMLAudioElement & {
  webkitShowPlaybackTargetPicker?: () => void
}

class MediaRoute {
  private streamDest: MediaStreamAudioDestinationNode | null = null
  private el: AirPlayElement | null = null
  private external = false
  private wakeLock: WakeLockSentinel | null = null
  private wantWakeLock = false

  // ---------------------------------------------------------------- routing

  get isExternal() {
    return this.external
  }

  /**
   * True when this browser can hand audio to an external device from inside the
   * page. On iOS this is Safari's AirPlay picker; elsewhere it is usually
   * absent, and the OS-level route picker is the answer instead.
   */
  canPickOutputDevice(): boolean {
    if (typeof document === 'undefined') return false
    const probe = document.createElement('audio') as AirPlayElement
    return typeof probe.webkitShowPlaybackTargetPicker === 'function'
  }

  /**
   * Moves the master output onto an <audio> element fed by a MediaStream, or
   * back to the default destination. Returns whether external mode is on.
   */
  async setExternal(enabled: boolean): Promise<boolean> {
    if (!engine.isStarted) return this.external
    if (enabled === this.external) return this.external

    const limiter = engine.output
    const ctx = Tone.getContext().rawContext as unknown as AudioContext

    if (enabled) {
      if (!this.streamDest) this.streamDest = ctx.createMediaStreamDestination()
      if (!this.el) {
        const el = document.createElement('audio') as AirPlayElement
        el.autoplay = true
        // Not user-visible; it exists purely to be an AirPlay-capable sink.
        el.style.display = 'none'
        el.setAttribute('playsinline', '')
        document.body.appendChild(el)
        this.el = el
      }
      limiter.disconnect()
      limiter.connect(this.streamDest)
      this.el.srcObject = this.streamDest.stream
      try {
        await this.el.play()
      } catch {
        // Autoplay refused: fall back rather than leaving the graph orphaned
        // with no audible output at all.
        limiter.disconnect()
        limiter.toDestination()
        this.external = false
        return false
      }
      this.external = true
    } else {
      this.el?.pause()
      if (this.el) this.el.srcObject = null
      limiter.disconnect()
      limiter.toDestination()
      this.external = false
    }
    return this.external
  }

  /** Opens Safari's AirPlay target picker. No-op where unsupported. */
  async showOutputPicker(): Promise<boolean> {
    if (!this.canPickOutputDevice()) return false
    if (!this.external) {
      const ok = await this.setExternal(true)
      if (!ok) return false
    }
    this.el?.webkitShowPlaybackTargetPicker?.()
    return true
  }

  // ---------------------------------------------------- lock-screen controls

  setMetadata(title: string, subtitle: string) {
    if (!('mediaSession' in navigator)) return
    const MD = (window as unknown as { MediaMetadata?: typeof MediaMetadata }).MediaMetadata
    if (!MD) return
    navigator.mediaSession.metadata = new MD({
      title,
      artist: subtitle,
      album: 'Resona',
      artwork: [
        { src: `${import.meta.env.BASE_URL}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
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
  async setWakeLock(want: boolean) {
    this.wantWakeLock = want
    if (want) await this.acquireWakeLock()
    else await this.releaseWakeLock()
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
      if (this.external) {
        try {
          await this.el?.play()
        } catch {
          /* the element needs a gesture too */
        }
      }
    } else {
      await this.releaseWakeLock()
    }
  }
}

export const mediaRoute = new MediaRoute()
