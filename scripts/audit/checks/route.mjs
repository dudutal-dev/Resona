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

export async function run(browser) {
  // Background audio is what puts the media element in the path; it is on by
  // default in the app, and the check is meaningless without it.
  const { ctx, page, errors } = await openApp(browser, { backgroundAudio: true })
  const result = await page.evaluate(async () => {
    const { useSession } = await import('/src/store/sessionStore.ts')
    const { useSettings } = await import('/src/store/settingsStore.ts')
    const { mediaRoute } = await import('/src/audio/MediaRoute.ts')
    const { engine } = await import('/src/audio/ToneEngine.ts')
    useSettings.getState().setBackgroundAudio(true)

    await useSession.getState().toggle()
    await new Promise((r) => setTimeout(r, 5000))

    const route = mediaRoute
    const trackOf = () => route.streamDest?.stream.getAudioTracks()[0]
    const before = trackOf()
    if (!route.isExternal || !before) {
      await useSession.getState().toggle()
      return { external: route.isExternal, reason: 'the live route never came up' }
    }

    // The interruption, as the platform delivers it: the stream's track ends,
    // and the context stops.
    before.stop()
    const raw = window.__audio.context.rawContext
    await raw.suspend()
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 5000))

    const after = trackOf()
    const out = {
      external: route.isExternal,
      deadTrackState: before.readyState,
      replaced: !!after && after.id !== before.id,
      liveAfter: after?.readyState === 'live',
      elementPlaying: !!route.el && !route.el.paused,
      graphSounding: engine.isProducingSound(),
      log: JSON.parse(localStorage.getItem('diagnostics') || '[]').map((e) => e.tag),
    }
    await useSession.getState().toggle()
    return out
  })
  await ctx.close()

  const failures = []
  if (result.reason) {
    failures.push(result.reason)
  } else {
    if (result.deadTrackState !== 'ended') failures.push('the simulated fault did not kill the track')
    if (!result.replaced) failures.push('the dead stream was kept — this is the reported bug')
    if (!result.liveAfter) failures.push('the new track is not live')
    if (!result.elementPlaying) failures.push('the media element is not playing after the rebuild')
    if (!result.log.includes('route-rebuilt') && !result.log.includes('route-fallback-direct')) {
      failures.push('the rebuild was not recorded in the log')
    }
  }
  return { rows: [result], failures, errors }
}
