/**
 * Asking the service worker, on demand, whether there is a newer build.
 *
 * The app registers with `registerType: 'autoUpdate'`, which sounds like it
 * covers this and does not. Workbox checks for a new worker when the page is
 * *loaded* — and an installed PWA on a phone is almost never loaded: it is
 * resumed. Switch away for a week, come back, and the app is still running the
 * worker it registered the first time. The only way to pick up a new build was
 * to close the app from the switcher and open it again, which is exactly the
 * thing a person should not have to know.
 *
 * So this is the same check, moved to a button. `registration.update()` fetches
 * the worker script and compares it byte for byte with the installed one; the
 * generated worker claims clients as soon as it activates, so once a new one
 * exists the only thing left to do is reload onto it.
 *
 * The states are reported honestly rather than optimistically: "no new version"
 * is a real answer and says so, and a failed check (offline, or a host that is
 * down) is not dressed up as being up to date.
 */

export type UpdateState =
  /** A newer build was found; the page is reloading onto it. */
  | 'updated'
  /** Checked, and this is already the newest build. */
  | 'current'
  /** No service worker here — a dev server, or the single-file build. */
  | 'unmanaged'
  /** The check itself failed: offline, or the host did not answer. */
  | 'failed'

/** How long to wait for a newly found worker to install before giving up. */
const INSTALL_TIMEOUT_MS = 20_000
/**
 * How long to wait, after it installs, for the new worker to take over the
 * page. Reloading before it does would be served by the *old* worker out of the
 * *old* precache — the update would be installed and invisible, which is the
 * bug this whole button exists to end.
 */
const CLAIM_TIMEOUT_MS = 4_000

function reload() {
  window.location.reload()
}

/** Resolves once `worker` reaches `installed`/`activated`, or the timeout. */
function settled(worker: ServiceWorker): Promise<boolean> {
  if (worker.state === 'installed' || worker.state === 'activated') return Promise.resolve(true)
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      worker.removeEventListener('statechange', onChange)
      clearTimeout(timer)
      resolve(ok)
    }
    const onChange = () => {
      if (worker.state === 'installed' || worker.state === 'activated') done(true)
      // `redundant` means this worker was thrown away — most often because it
      // failed to install. Nothing is coming; do not sit on the timeout.
      else if (worker.state === 'redundant') done(false)
    }
    const timer = setTimeout(() => done(false), INSTALL_TIMEOUT_MS)
    worker.addEventListener('statechange', onChange)
  })
}

/** Resolves when a different worker is controlling the page, or on timeout. */
function claimed(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', done)
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(done, CLAIM_TIMEOUT_MS)
    navigator.serviceWorker.addEventListener('controllerchange', done)
  })
}

/**
 * Tell a worker that has finished installing not to wait for the tab to close.
 *
 * A function rather than an inline call because the check above narrows
 * `registration.waiting` to null for the rest of the body — reading it through
 * a parameter asks the browser again, which is the point: it may have appeared
 * since.
 */
/** The worker script's own address, read through a parameter for the same
 * reason as `skipWaiting` below: the narrowing above would otherwise insist
 * `waiting` is null. */
function scriptUrl(registration: ServiceWorkerRegistration): string | undefined {
  return (
    registration.active?.scriptURL ??
    registration.waiting?.scriptURL ??
    registration.installing?.scriptURL
  )
}

function skipWaiting(registration: ServiceWorkerRegistration) {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
}

export async function checkForUpdate(): Promise<UpdateState> {
  if (!('serviceWorker' in navigator)) return 'unmanaged'

  let reg: ServiceWorkerRegistration | undefined
  try {
    reg = await navigator.serviceWorker.getRegistration()
  } catch {
    return 'failed'
  }
  if (!reg) return 'unmanaged'

  // A worker that already finished installing and is waiting for the tab to go
  // away. Nothing to fetch — it is the new build, sitting there.
  if (reg.waiting) {
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    await claimed()
    reload()
    return 'updated'
  }

  // Reachability first, and by hand.
  //
  // `update()` reads as if it rejects when the worker script cannot be fetched.
  // Measured against this build with the network cut, it resolved — and found
  // nothing, because nothing could be fetched. The button then said "this is
  // the newest build", which is exactly the reassuring lie it exists to avoid.
  // Fetching the worker's own script settles it: same file, same origin, and
  // `no-store` so no cache can answer for the network.
  const script = scriptUrl(reg)
  if (script) {
    try {
      const probe = await fetch(script, { cache: 'no-store' })
      if (!probe.ok) return 'failed'
    } catch {
      return 'failed'
    }
  }

  try {
    await reg.update()
  } catch {
    return 'failed'
  }

  const fresh = reg.installing ?? reg.waiting
  if (!fresh) return 'current'

  const ready = await settled(fresh)
  if (!ready) return 'failed'
  skipWaiting(reg)
  await claimed()
  reload()
  return 'updated'
}

/**
 * The fallback for `unmanaged`: no worker is holding anything back, so a plain
 * reload already fetches whatever the server has. Kept separate so the caller
 * decides, and so the reason shown on screen stays true.
 */
export function reloadNow() {
  reload()
}
