/**
 * Handing a video element to a television, rather than mirroring the phone.
 *
 * The note at the bottom of `MediaRoute` records why casting the *canvas* could
 * never work: AirPlay carries a media **source**, not an arbitrary MediaStream,
 * so `canvas.captureStream()` was ignored and the receiver showed the Now
 * Playing card. That finding is exact, and it is also what makes this possible —
 * the figure is now a real file on a real `<video>`, which is precisely the kind
 * of thing AirPlay does carry.
 *
 * What travels is the clip and nothing else. The waveform shear, the blurred
 * wash and the readouts are drawn on the phone's canvas, and a receiver playing
 * a URL knows nothing about any of that. So this is a deliberate trade rather
 * than an upgrade: mirroring sends the whole treatment and holds the phone
 * hostage; casting sends a clean loop and gives the phone back. Both are
 * offered, and the screen says which is which.
 *
 * Two APIs, because no single one covers the devices this runs on. The standard
 * Remote Playback API is what Chrome implements for Cast; Safari has had its own
 * prefixed pair since long before that and is what an iPhone will actually use.
 * Availability is watched rather than assumed, so the button only exists when
 * there is somewhere for it to send anything.
 */

type RemoteCapable = HTMLVideoElement & {
  /** Safari, still prefixed. */
  webkitShowPlaybackTargetPicker?: () => void
  webkitCurrentPlaybackTargetIsWireless?: boolean
}

export type RemoteState = 'unsupported' | 'unavailable' | 'available' | 'connected'

/** True when this build of this browser can offer a picker at all. */
export function canCastVideo(): boolean {
  if (typeof document === 'undefined') return false
  const probe = document.createElement('video') as RemoteCapable
  return (
    typeof probe.webkitShowPlaybackTargetPicker === 'function' ||
    typeof (probe as HTMLVideoElement).remote?.prompt === 'function'
  )
}

/**
 * Reports whether a receiver is in range and whether this element is on one.
 * Returns its own teardown.
 */
export function watchRemote(video: HTMLVideoElement, onChange: (state: RemoteState) => void) {
  const el = video as RemoteCapable
  if (!canCastVideo()) {
    onChange('unsupported')
    return () => {}
  }

  let available = false
  const emit = () => {
    // Safari reports the connected state on the element; the standard API
    // reports it through `remote.state`. Either one being true is enough.
    const connected =
      el.webkitCurrentPlaybackTargetIsWireless === true || el.remote?.state === 'connected'
    onChange(connected ? 'connected' : available ? 'available' : 'unavailable')
  }

  // Safari: availability and connection arrive as two separate events.
  const onAvail = (e: Event) => {
    available = (e as Event & { availability?: string }).availability === 'available'
    emit()
  }
  el.addEventListener('webkitplaybacktargetavailabilitychanged', onAvail)
  el.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', emit)

  // Standard: a watcher for availability, plus connect/disconnect events.
  let watchId: number | null = null
  el.remote?.watchAvailability?.((isAvailable) => {
    available = isAvailable
    emit()
  })
    .then((id) => {
      watchId = id
    })
    .catch(() => {
      /* some builds expose `remote` but refuse to watch; the picker may still work */
    })
  el.remote?.addEventListener('connect', emit)
  el.remote?.addEventListener('disconnect', emit)

  emit()

  return () => {
    el.removeEventListener('webkitplaybacktargetavailabilitychanged', onAvail)
    el.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', emit)
    el.remote?.removeEventListener('connect', emit)
    el.remote?.removeEventListener('disconnect', emit)
    if (watchId !== null) void el.remote?.cancelWatchAvailability?.(watchId).catch(() => {})
  }
}

/**
 * Opens the system's device picker for this element. Must be called from inside
 * a real tap: both APIs require a user gesture and both fail silently otherwise.
 */
export async function promptRemote(video: HTMLVideoElement): Promise<boolean> {
  const el = video as RemoteCapable
  if (typeof el.webkitShowPlaybackTargetPicker === 'function') {
    el.webkitShowPlaybackTargetPicker()
    return true
  }
  try {
    await el.remote?.prompt()
    return true
  } catch {
    // A cancelled picker throws exactly like a failed one, so this is not an
    // error worth surfacing — the state watcher says what actually happened.
    return false
  }
}
