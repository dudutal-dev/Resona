/**
 * Pulling a media file through `fetch` once, purely so the service worker keeps
 * a copy of it.
 *
 * A video element asks for its file with a `Range` header, and a ranged media
 * request does not end up in the runtime cache: measured on a production build,
 * the cache was still empty after a full playthrough of television mode, while
 * one plain fetch of the same URL filled it. What was holding the clip instead
 * was the browser's own HTTP cache, which is evictable and is not what an
 * offline-first app should be resting on. Cache Storage is.
 *
 * It is meant to run alongside playback rather than before it, so the first
 * frame still appears while the file streams. That costs the bytes twice on the
 * very first viewing and nothing on every viewing after.
 */

/** URLs already pulled, so a play/pause cycle does not ask for the same file. */
const warmed = new Set<string>()

export function warmMedia(url: string) {
  if (warmed.has(url)) return
  warmed.add(url)
  fetch(url)
    .then((res) => res.arrayBuffer())
    .catch(() => warmed.delete(url))
}
