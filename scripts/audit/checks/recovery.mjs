import { openApp, wait } from '../harness.mjs'

/**
 * The interruption, and coming back from it.
 *
 * This is the fault that made the app unusable — leave it, come back, and the
 * session was counting down over silence until the whole thing was relaunched.
 * The recovery paths for it cannot be reproduced on iOS from here, but the one
 * mechanism they all end in can: a context that stopped, a resume, and audio
 * actually flowing again afterwards.
 *
 * The diagnostics log is checked too, because a recovery nobody can see is one
 * nobody can debug on a phone.
 */
export const name = 'recovery'
export const about = 'an interrupted context comes back, sounding'

export async function run(browser) {
  const { ctx, page, errors } = await openApp(browser)
  const result = await page.evaluate(async () => {
    const { useSession } = await import('/src/store/sessionStore.ts')
    const { engine } = await import('/src/audio/ToneEngine.ts')
    await useSession.getState().toggle()
    await new Promise((r) => setTimeout(r, 3500))
    const soundingBefore = engine.isProducingSound()

    const raw = window.__audio.context.rawContext
    await raw.suspend()
    // Read immediately. The app watches the context's own `statechange` and
    // resumes within a quarter of a second, so a check that waits first sees a
    // running context and concludes, wrongly, that nothing ever stopped — which
    // is what the first version of this check did.
    const stateWhileOut = raw.state
    await new Promise((r) => setTimeout(r, 1500))
    // What the platform sends when the app comes back to the front.
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 3500))

    const out = {
      soundingBefore,
      stateWhileOut,
      stateAfter: raw.state,
      soundingAfter: engine.isProducingSound(),
      log: JSON.parse(localStorage.getItem('diagnostics') || '[]').map((e) => e.tag),
    }
    await useSession.getState().toggle()
    return out
  })
  await ctx.close()

  const failures = []
  if (!result.soundingBefore) failures.push('nothing was sounding before the interruption')
  if (result.stateWhileOut === 'running') failures.push('the context never actually stopped')
  if (result.stateAfter !== 'running') failures.push(`context stayed ${result.stateAfter}`)
  if (!result.soundingAfter) failures.push('context came back but no audio is flowing')
  if (!result.log.includes('context-lost')) failures.push('the interruption was not recorded in the log')
  if (!result.log.includes('resumed')) failures.push('the recovery was not recorded in the log')

  return {
    rows: [{
      before: result.soundingBefore ? 'sounding' : 'silent',
      interrupted: result.stateWhileOut,
      after: result.stateAfter,
      sounding: result.soundingAfter ? 'yes' : 'no',
      logged: result.log.join(' '),
    }],
    failures,
    errors,
  }
}
