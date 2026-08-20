import { openApp, wait } from '../harness.mjs'

/**
 * The medley: every figure in turn, dissolving from one into the next.
 *
 * Two things have to be true of it and neither is obvious from the code. It has
 * to actually *change* — a montage that shows one scene for a minute is a clip
 * with extra machinery — and it must never dissolve into black, which is what
 * happens if a layer is faded up before the browser has decoded a frame of it.
 *
 * There is a wrinkle in checking that here, and it took a probe to find it:
 * this Chromium has no H.264, so the clips never decode and every element sits
 * at `readyState 0`. The app behaves correctly under that — the incoming layer
 * is never faded up, so the working scene stays — but the dissolve itself would
 * then never run, and the dissolve is the part worth checking. So the readiness
 * the browser cannot give is stubbed in: the elements are made to report frames,
 * which puts the real fade path under test rather than a description of it.
 */
export const name = 'medley'
export const about = 'the montage changes scene, and never through black'

/** Long enough for two changes at the longest hold the music can ask for. */
const WATCH_SECONDS = 58

export async function run(browser) {
  const { ctx, page, errors } = await openApp(browser, { theme: 'dark' })
  const result = await page.evaluate(
    async (seconds) => {
      const { useSession } = await import('/src/store/sessionStore.ts')
      const { useSettings } = await import('/src/store/settingsStore.ts')
      const { FIGURES } = await import('/src/data/figures.ts')
      const medleyIndex = FIGURES.findIndex((f) => f.kind === 'medley')
      useSettings.getState().setFigure(medleyIndex)
      await useSession.getState().toggle()
      await new Promise((r) => setTimeout(r, 1500))

      // Open the stage by pressing the button that opens it, since it is local
      // state on the player screen rather than a route.
      // The readiness this browser cannot produce. Frames, and a clock that
      // moves, which is all `MedleyField` asks before it will fade anything up.
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
      })
      Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        configurable: true,
        get: () => performance.now() / 1000,
        set: () => {},
      })

      const button = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('טלוויזיה'),
      )
      button?.click()
      await new Promise((r) => setTimeout(r, 2500))

      const seen = new Set()
      let darkFrames = 0
      let samples = 0
      const end = performance.now() + seconds * 1000
      while (performance.now() < end) {
        const videos = [...document.querySelectorAll('video')].filter(
          (v) => v.src && getComputedStyle(v).display !== 'none',
        )
        // Only the layers of the montage: the cast element is transparent and
        // parked, and it never carries opacity of its own.
        const lit = videos.filter((v) => Number(getComputedStyle(v).opacity) > 0.08)
        for (const v of lit) {
          if (Number(getComputedStyle(v).opacity) > 0.5) seen.add(v.src.split('/').pop())
        }
        // Nothing lit at all, at any moment, is the black dissolve.
        if (videos.length && lit.length === 0) darkFrames++
        samples++
        await new Promise((r) => setTimeout(r, 250))
      }
      await useSession.getState().toggle()
      return { sources: [...seen], samples, darkFrames, available: medleyIndex >= 0 }
    },
    WATCH_SECONDS,
  )
  await ctx.close()

  const failures = []
  if (!result.available) failures.push('there is no medley figure to test')
  if (result.sources.length < 2) {
    failures.push(`only ${result.sources.length} scene(s) in ${WATCH_SECONDS}s — it never changed`)
  }
  if (result.darkFrames > 0) {
    failures.push(`${result.darkFrames} of ${result.samples} samples had nothing on screen`)
  }
  return { rows: [{ ...result, sources: result.sources.join(' ') }], failures, errors }
}
