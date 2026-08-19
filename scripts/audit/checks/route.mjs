import { openApp } from '../harness.mjs'

/**
 * The fault a phone call causes, reproduced.
 *
 * Reported from a real device: a call comes in, the app comes back looking
 * completely normal — clock running, visualiser moving — and plays nothing
 * until it is killed and relaunched. The cause is not the audio graph, which is
 * why every check that measures the graph said the app was fine: with
 * background audio on, the sound leaves through a MediaStream feeding an
 * `<audio>` element, and iOS ends that stream's track over an interruption. An
 * ended track cannot be revived. The element still reports itself as playing.
 *
 * A real call cannot be dialled in here, but the mechanism can: stopping the
 * track produces exactly the same state — live graph, playing element, silence.
 * What this asserts is that the app notices and builds a new route rather than
 * trusting the graph.
 */
export const name = 'route'
export const about = 'a dead output stream is rebuilt, not trusted'

/**
 * The three ways the route dies, each of them observed rather than imagined.
 *
 *  - `track`     the stream's track ends. What a call does to a cast.
 *  - `silent`    the same, with the context never interrupted — which is what a
 *                real phone call actually produced: not one line in the log,
 *                because the graph renders into a stream and the system has no
 *                reason to touch it.
 *  - `paused`    the system pauses the element and leaves everything else
 *                intact.
 */
const FAULTS = ['track', 'silent', 'paused']

export async function run(browser) {
  // Background audio is what puts the media element in the path; it is on by
  // default in the app, and the check is meaningless without it.
  const { ctx, page, errors } = await openApp(browser, { backgroundAudio: true })
  const results = await page.evaluate(async (faults) => {
    const { useSession } = await import('/src/store/sessionStore.ts')
    const { useSettings } = await import('/src/store/settingsStore.ts')
    const { mediaRoute } = await import('/src/audio/MediaRoute.ts')
    const { engine } = await import('/src/audio/ToneEngine.ts')
    // Cleared through the module, not through localStorage: the log keeps its
    // entries in memory and writing the key underneath it leaves every fault
    // carrying the previous fault's evidence.
    const { clearDiagnostics, readDiagnostics } = await import('/src/lib/diagnostics.ts')
    useSettings.getState().setBackgroundAudio(true)

    const route = mediaRoute
    const trackOf = () => route.streamDest?.stream.getAudioTracks()[0]
    const rows = []

    for (const fault of faults) {
      await useSession.getState().toggle()
      await new Promise((r) => setTimeout(r, 5000))
      const before = trackOf()
      if (!route.isExternal || !before) {
        rows.push({ fault, reason: 'the live route never came up' })
        await useSession.getState().toggle()
        await new Promise((r) => setTimeout(r, 2500))
        continue
      }
      clearDiagnostics()

      const raw = window.__audio.context.rawContext
      if (fault === 'track') {
        before.stop()
        await raw.suspend()
      } else if (fault === 'silent') {
        // The reported fault, exactly: the stream dies and the context is never
        // told anything at all.
        before.stop()
      } else if (fault === 'paused') {
        route.el.pause()
      }
      // Coming back to the app is the only thing the person does.
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((r) => setTimeout(r, 6000))

      const after = trackOf()
      rows.push({
        fault,
        // Either repair counts: a paused element that simply starts again did
        // not need a new stream, and rebuilding one would be a gap for nothing.
        flowing: !!route.el && !route.el.paused && after?.readyState === 'live',
        rebuilt: !!after && after.id !== before.id,
        graphSounding: engine.isProducingSound(),
        log: readDiagnostics().map((e) => e.tag).join(' '),
      })
      await useSession.getState().toggle()
      await new Promise((r) => setTimeout(r, 2500))
    }
    return rows
  }, FAULTS)
  await ctx.close()

  const failures = []
  for (const r of results) {
    if (r.reason) {
      failures.push(`${r.fault}: ${r.reason}`)
      continue
    }
    if (!r.flowing) failures.push(`${r.fault}: the route is still dead — this is the reported bug`)
    // Any of the repairs counts, including the quiet one: an element the system
    // paused and that simply started again needed no new stream.
    if (!/route-(rebuilt|resumed|fallback-direct)|element-restarted/.test(r.log)) {
      failures.push(`${r.fault}: the repair was not recorded in the log (${r.log || 'nothing logged'})`)
    }
  }
  // The track faults cannot be repaired by starting the element again; a
  // rebuild is the only thing that can work, and "flowing" without one would
  // mean the check is measuring something else.
  for (const r of results) {
    if ((r.fault === 'track' || r.fault === 'silent') && !r.rebuilt) {
      failures.push(`${r.fault}: the dead stream was kept`)
    }
  }
  return { rows: results, failures, errors }
}
