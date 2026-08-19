/**
 * The shared machinery every check needs: a dev server, a browser, and a page
 * that is provably driving the same modules the check is about to reach into.
 *
 * A dev server rather than a build, because the audio graph only exposes itself
 * under `import.meta.env.DEV` — the shipped bundle has no handle on the limiter,
 * and measuring what leaves the app is the entire point of this suite.
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

export const PORT = Number(process.env.AUDIT_PORT || 5177)
const ORIGIN = `http://localhost:${PORT}`
/** Chromium's own binary in this environment; overridable for other machines. */
const BROWSER = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium'

export async function startServer() {
  // A server that is already listening is refused rather than reused. It cost a
  // run to learn why: a long-lived dev server accumulates hot reloads, and a
  // page that has hot reloaded can hold a second copy of a store — so the
  // checks measured a module nobody was rendering and reported that the app was
  // broken. A fresh server per run is the only version of this that can be
  // trusted.
  if (await answers()) {
    throw new Error(`something is already serving on ${PORT}; stop it first (the audit needs a fresh server)`)
  }

  // Vite directly, not through npm: killing the npm wrapper leaves its child
  // vite process listening, which is how the stale server above got there.
  // `detached` puts it in its own group so the whole group can be signalled.
  const proc = spawn('node_modules/.bin/vite', ['--port', String(PORT), '--strictPort'], {
    cwd: new URL('../..', import.meta.url).pathname,
    stdio: 'ignore',
    detached: true,
  })
  const stop = () => {
    try {
      process.kill(-proc.pid, 'SIGTERM')
    } catch {
      proc.kill('SIGTERM')
    }
  }

  const deadline = Date.now() + 40_000
  while (Date.now() < deadline) {
    if (await answers()) return stop
    await wait(400)
  }
  stop()
  throw new Error(`the dev server did not come up on ${PORT}`)
}

async function answers() {
  try {
    const res = await fetch(ORIGIN)
    return res.ok
  } catch {
    return false
  }
}

export async function launch() {
  return chromium.launch({
    executablePath: BROWSER,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader'],
  })
}

/** The settings a check starts from: no opening notice, no motion surprises. */
export const BOOT = {
  theme: 'dark', lang: 'he', reducedMotion: false, headphoneNoticeSeen: true,
  keepScreenAwake: false, backgroundAudio: false, figure: 0,
}

/**
 * Opens the app and proves the page shares the module instances the check will
 * drive.
 *
 * This assertion exists because it caught real nonsense: a page that has hot
 * reloaded can hold two copies of a store, and a probe that sets state on the
 * copy nobody renders reports confident, wrong numbers. Cheap to check, and the
 * alternative is trusting a measurement of nothing.
 */
export async function openApp(browser, settings = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript((s) => localStorage.setItem('settings', JSON.stringify(s)), { ...BOOT, ...settings })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 160)}`) })
  await page.goto(ORIGIN)
  await wait(1200)
  // The splash is dismissed by a tap anywhere; dispatching beats hit-testing an
  // element that is still animating in.
  for (let i = 0; i < 10 && (await page.locator('[role=dialog]').count()); i++) {
    await page.locator('[role=dialog]').first().dispatchEvent('click').catch(() => {})
    await wait(500)
  }
  const linked = await page.evaluate(async () => {
    const store = await import('/src/store/sessionStore.ts')
    window.location.hash = '#/player'
    await new Promise((r) => setTimeout(r, 500))
    const before = document.body.innerText
    store.useSession.getState().setRoot('sol-639')
    await new Promise((r) => setTimeout(r, 700))
    const moved = document.body.innerText !== before && /639/.test(document.body.innerText)
    store.useSession.getState().setRoot('sol-528')
    await new Promise((r) => setTimeout(r, 400))
    return moved
  })
  if (!linked) throw new Error('the page is not driving the store this check reaches into')
  return { ctx, page, errors }
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * What leaves the app, measured at the limiter — the last node before the
 * destination, so it includes every trim, the bass shelf and the limiting.
 */
export const MEASURE = `async (seconds) => {
  const a = window.__audio
  const ac = a.context.rawContext
  const an = ac.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0
  a.limiter.connect(an)
  const t = new Float32Array(an.fftSize)
  let peak = 0, sum = 0, n = 0
  const end = performance.now() + seconds * 1000
  while (performance.now() < end) {
    an.getFloatTimeDomainData(t)
    for (const v of t) { const av = Math.abs(v); if (av > peak) peak = av; sum += v * v; n++ }
    await new Promise((r) => setTimeout(r, 16))
  }
  a.limiter.disconnect(an)
  const rms = Math.sqrt(sum / n)
  const db = (x) => +(20 * Math.log10(x || 1e-9)).toFixed(1)
  return { rmsDb: db(rms), peakDb: db(peak) }
}`
