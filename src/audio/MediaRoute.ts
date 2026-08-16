import { Tone } from './ToneEngine'

/**
 * Everything to do with where the sound goes and who controls it.
 *
 * Three separate concerns, all of them constrained by what browsers actually
 * allow rather than by what would be convenient:
 *
 * 1. **Lock-screen / headset controls** via the Media Session API. Widely
 *    supported and cheap, so it is always on while playing.
 *
 * 2. **Now-playing attribution**, so the system credits this app rather than
 *    whichever media app happened to hold the session before it.
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

class MediaRoute {
  private wakeLock: WakeLockSentinel | null = null
  private wantWakeLock = false
  private silent: HTMLAudioElement | null = null

  // ---------------------------------------------------------------- routing

  /**
   * There is deliberately no in-page way to send this audio to a speaker.
   *
   * An earlier build tried: re-route the master into a MediaStream, feed it to
   * an <audio> element, and open Safari's playback-target picker on that. The
   * picker appeared, `play()` resolved without throwing — and nothing came out,
   * because Safari does not actually render a Web-Audio-backed MediaStream
   * through an audio element. Since the old path had already been disconnected
   * from the destination by then, pressing the button silenced the app
   * outright, and the "fall back if play() rejects" guard never fired because
   * play() had not rejected.
   *
   * AirPlay only accepts a real media resource, and a generative synth has no
   * such thing to hand it. The OS-level route does work — picking a target in
   * Control Center moves every sound on the device, this app included — so
   * that is what the UI points at instead of offering a control that cannot
   * keep its promise.
   */
  readonly canRouteInPage = false

  // ------------------------------------------------------- now-playing claim

  /**
   * Makes the system attribute the current audio to this app.
   *
   * iOS only hands the Now Playing session — the lock-screen card, and the name
   * shown when audio is routed to a speaker or a car — to a page that has an
   * HTMLMediaElement actually playing. A Web Audio graph on its own claims
   * nothing, so the system keeps displaying whichever media app held the
   * session last, which is why sessions showed up labelled "Apple Music".
   *
   * A looping silent element is enough to take the claim, at which point the
   * Media Session metadata set below is what gets displayed.
   */
  async claimNowPlaying() {
    if (!this.silent) {
      const el = document.createElement('audio')
      el.src = silentWavUrl()
      el.loop = true
      el.setAttribute('playsinline', '')
      // Not muted: a muted element does not count as playing media, which is
      // the entire point of having it.
      el.volume = 0.001
      el.style.display = 'none'
      document.body.appendChild(el)
      this.silent = el
    }
    try {
      await this.silent.play()
    } catch {
      // Needs a user gesture; the session still plays, it just keeps the
      // system's previous attribution.
    }
  }

  releaseNowPlaying() {
    this.silent?.pause()
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
      // Retake the now-playing claim; the silent element is paused when the
      // page is hidden on some platforms.
      await this.claimNowPlaying()
    } else {
      await this.releaseWakeLock()
    }
  }
}

export const mediaRoute = new MediaRoute()
