import { openApp, wait } from '../harness.mjs'

/**
 * The stutter, and whether the app can see it.
 *
 * Reported twice from a real device, both times while casting to a network
 * speaker: the drone sticks and repeats across the melody. A receiver fed from
 * a MediaStream has no buffer of its own, so anything that stops the graph
 * rendering on time is heard as the last fragment repeating.
 *
 * The cast itself cannot be reproduced here — nothing in this environment
 * receives AirPlay — and the first version of this check disproved its own
 * premise: holding the main thread for two and a half seconds moved the audio
 * clock not at all, because Web Audio renders on its own thread. A stalled page
 * does not starve the graph.
 *
 * So the instrument watches the other end of the pipe as well, where the
 * symptom actually lives: whether the element is still draining the stream. The
 * positive case needs a receiver and cannot be staged here, and this check does
 * not pretend otherwise. What it does hold is the negative control, which is
 * the property that decides whether the instrument is usable at all: through
 * healthy playback, including a badly stalled main thread, it must stay silent.
 * An instrument that cries wolf would send the next report chasing a fault that
 * was never there.
 */
export const name = 'starve'
export const about = 'the output-health watch stays silent on healthy playback'

export async function run(browser) {
  const { ctx, page, errors } = await openApp(browser)
  const result = await page.evaluate(async () => {
    const { useSession } = await import('/src/store/sessionStore.ts')
    const { clearDiagnostics, readDiagnostics } = await import('/src/lib/diagnostics.ts')
    await useSession.getState().toggle()
    await new Promise((r) => setTimeout(r, 4000))
    clearDiagnostics()

    // A healthy stretch first: the watcher must not cry starvation at idle.
    await new Promise((r) => setTimeout(r, 9000))
    const quiet = readDiagnostics().filter((e) => e.tag === 'audio-starved').length

    // Then hold the thread. Blocking it is what a heavy page, a backgrounded
    // tab or a struggling phone does to the render loop.
    const until = performance.now() + 2500
    while (performance.now() < until) {
      // Busy on purpose.
    }
    await new Promise((r) => setTimeout(r, 9000))
    const entries = readDiagnostics()
    const afterStall = entries.filter((e) => e.tag === 'audio-starved')
    const stalls = entries.filter((e) => e.tag === 'element-stalled')

    await useSession.getState().toggle()
    return { quiet, seen: afterStall.length, stalls: stalls.length, detail: afterStall[0]?.detail ?? '' }
  })
  await ctx.close()

  const failures = []
  if (result.quiet > 0) failures.push(`starvation reported on a healthy graph (${result.quiet}×)`)
  if (result.seen > 0) failures.push(`a stalled main thread was reported as a starved graph (${result.seen}×) — it is not one`)
  if (result.stalls > 0) failures.push(`the element was called stalled while playing normally (${result.stalls}×)`)

  return { rows: [result], failures, errors }
}
