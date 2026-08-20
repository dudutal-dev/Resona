/**
 * `npm run audit` — the checks that need a running app and a real audio graph.
 *
 * The unit tests cover what can be decided from data: the scale maths, the
 * catalogue, the journey builder. Everything that only exists once the app is
 * playing — output levels, the pitches actually triggered, the club patterns,
 * the return from an interruption, and whether the screens render at all — used
 * to be checked by one-off scripts that were thrown away afterwards. Which means
 * that in practice each was checked exactly once, on the day it was written.
 *
 * Run everything, or name the checks:  npm run audit -- levels groove
 */
import { launch, startServer } from './harness.mjs'
import * as levels from './checks/levels.mjs'
import * as anchor from './checks/anchor.mjs'
import * as groove from './checks/groove.mjs'
import * as recovery from './checks/recovery.mjs'
import * as route from './checks/route.mjs'
import * as share from './checks/share.mjs'
import * as starve from './checks/starve.mjs'
import * as screens from './checks/screens.mjs'

const ALL = [levels, anchor, groove, recovery, route, starve, share, screens]

const asked = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const checks = asked.length ? ALL.filter((c) => asked.includes(c.name)) : ALL
if (!checks.length) {
  console.error(`no such check. available: ${ALL.map((c) => c.name).join(', ')}`)
  process.exit(2)
}

const stopServer = await startServer()
const browser = await launch()
let failed = 0

try {
  for (const check of checks) {
    const started = Date.now()
    process.stdout.write(`\n▸ ${check.name} — ${check.about}\n`)
    let result
    try {
      result = await check.run(browser)
    } catch (e) {
      console.log(`  ✗ the check itself failed: ${e.message}`)
      failed++
      continue
    }
    if (result.rows?.length) console.table(result.rows)
    // Page errors are reported but do not fail a check on their own: a console
    // error from a browser extension or a dev-server reconnect is not a defect
    // in the app, and a suite that cries wolf gets ignored.
    if (result.errors?.length) console.log(`  page errors: ${result.errors.slice(0, 4).join(' | ')}`)
    const seconds = Math.round((Date.now() - started) / 1000)
    if (result.failures.length) {
      failed++
      for (const f of result.failures) console.log(`  ✗ ${f}`)
      console.log(`  FAILED in ${seconds}s`)
    } else {
      console.log(`  ✓ passed in ${seconds}s${result.note ? ` (${result.note})` : ''}`)
    }
  }
} finally {
  await browser.close()
  stopServer()
}

console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
