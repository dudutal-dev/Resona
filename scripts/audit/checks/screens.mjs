import { BOOT, PORT, wait } from '../harness.mjs'

/**
 * Every screen, in every theme, in both languages.
 *
 * Cheap and unglamorous, and it has caught more than anything else here: a
 * screen that renders nothing, a string that exists in Hebrew and not in
 * English, markup leaking into text, a route that throws. Six of these
 * combinations are the ones nobody ever opens by hand.
 */
export const name = 'screens'
export const about = 'every route renders in every theme and language'

const ROUTES = [
  '/', '/player', '/frequencies', '/journeys', '/presets', '/settings', '/about', '/build',
  '/journey/journey-innerspace-7', '/journey/journey-innerspace-7/day/3', '/journey/does-not-exist',
]
/** Below this a screen is not a screen; the 404 is the thinnest legitimate one. */
const MIN_CHARS = 60

export async function run(browser) {
  const results = []
  const failures = []
  const errors = []

  for (const theme of ['dark', 'noir', 'light']) {
    for (const lang of ['he', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
      await ctx.addInitScript((s) => localStorage.setItem('settings', JSON.stringify(s)), { ...BOOT, theme, lang })
      const page = await ctx.newPage()
      page.on('pageerror', (e) => errors.push(`${theme}/${lang}: ${e.message.slice(0, 120)}`))
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`${theme}/${lang}: ${m.text().slice(0, 120)}`) })
      await page.goto(`http://localhost:${PORT}/`)
      await wait(1100)
      for (let i = 0; i < 10 && (await page.locator('[role=dialog]').count()); i++) {
        await page.locator('[role=dialog]').first().dispatchEvent('click').catch(() => {})
        await wait(400)
      }

      for (const route of ROUTES) {
        await page.evaluate((r) => { window.location.hash = r }, route)
        await wait(500)
        const text = await page.evaluate(() => document.body.innerText)
        const where = `${route} [${theme}/${lang}]`
        if (text.trim().length < MIN_CHARS) failures.push(`${where}: blank (${text.trim().length} chars)`)
        // A key that reached the screen instead of its translation.
        if (/\b[a-z]+\.[a-zA-Z]+[A-Z]\w*\b/.test(text) && !/[.]\s/.test(text.slice(0, 40))) {
          const key = text.match(/\b[a-z]+\.[a-zA-Z]+[A-Z]\w*\b/)?.[0]
          if (key && !key.includes('.co') && !key.includes('.ai')) failures.push(`${where}: untranslated key ${key}`)
        }
        if (/<[a-z]+>|&nbsp;|&lt;/.test(text)) failures.push(`${where}: markup in text`)
        // English screens must not fall back to Hebrew — except for the one
        // place Hebrew belongs on an English screen: the language picker names
        // each language in its own language, so "עברית" there is correct. This
        // check flagged it on its first run, which is the right instinct and the
        // wrong verdict.
        if (lang === 'en' && /[֐-׿]/.test(text.replace(/עברית/g, ''))) {
          failures.push(`${where}: Hebrew text on an English screen`)
        }
        results.push({ route, theme, lang, chars: text.trim().length })
      }
      await ctx.close()
    }
  }

  const thinnest = [...results].sort((a, b) => a.chars - b.chars).slice(0, 3)
  return {
    rows: thinnest.map((r) => ({ ...r, note: 'thinnest' })),
    failures,
    errors,
    note: `${results.length} renders`,
  }
}
