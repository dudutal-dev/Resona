/**
 * Transcodes the figure artwork into what the app actually ships.
 *
 *   node scripts/pack-figures.mjs
 *
 * The sources in `assets/figures` are PNG screenshots straight off a phone: four
 * of them come to about six megabytes, which is not something to put in a service
 * worker's precache. They are photographic — glowing bodies against black, no
 * flat colour and no sharp text — so PNG is the wrong container for them twice
 * over, and WebP at high quality takes about a tenth of the space with nothing
 * visible lost against a dark background.
 *
 * There is no image library in this project and no reason to add one, so the
 * encoding is done by the browser that is already installed for the end-to-end
 * tests: a canvas, `toDataURL('image/webp', …)`, and the bytes written out. If
 * Playwright is not available the script says so and changes nothing — the
 * encoded files are committed, so a normal build never needs this to run.
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = resolve(HERE, '../assets/figures')
const OUT_DIR = resolve(HERE, '../src/assets/figures')

/** High enough that nothing shows on a 4K panel; low enough to matter. */
const QUALITY = 0.86

// Looked for beside this script and beside whatever directory it was run from,
// since the one machine that has Playwright installed may not be this project.
let chromium
try {
  const local = createRequire(import.meta.url)
  const cwd = createRequire(join(process.cwd(), 'package.json'))
  const path = (() => {
    try {
      return local.resolve('playwright')
    } catch {
      return cwd.resolve('playwright')
    }
  })()
  // Playwright is CommonJS, so depending on how it resolves the named export may
  // only be reachable through the default one.
  const module = await import(path)
  chromium = module.chromium ?? module.default?.chromium
  if (!chromium) throw new Error('no chromium export')
} catch {
  console.error(
    'pack-figures needs Playwright, which this project does not depend on.\n' +
      'The encoded figures are committed, so this only has to run when the\n' +
      'artwork changes. Install it somewhere reachable and run again:\n' +
      '  npm i -g playwright   (or run this from a directory that has it)',
  )
  process.exit(1)
}

const sources = readdirSync(SOURCE_DIR)
  .filter((f) => f.endsWith('.png'))
  .sort()
if (!sources.length) throw new Error(`no PNGs in ${SOURCE_DIR}`)

mkdirSync(OUT_DIR, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
})
const page = await browser.newPage()

let before = 0
let after = 0
for (const name of sources) {
  const png = readFileSync(join(SOURCE_DIR, name))
  before += png.length
  const encoded = await page.evaluate(
    async ([data, quality]) => {
      const image = new Image()
      image.src = `data:image/png;base64,${data}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d').drawImage(image, 0, 0)
      const url = canvas.toDataURL('image/webp', quality)
      if (!url.startsWith('data:image/webp')) throw new Error('this browser did not encode WebP')
      return { data: url.slice(url.indexOf(',') + 1), w: canvas.width, h: canvas.height }
    },
    [png.toString('base64'), QUALITY],
  )
  const out = Buffer.from(encoded.data, 'base64')
  after += out.length
  const target = name.replace(/\.png$/, '.webp')
  writeFileSync(join(OUT_DIR, target), out)
  console.log(
    `${name} ${encoded.w}x${encoded.h}  ${(png.length / 1024).toFixed(0)}KB -> ` +
      `${target} ${(out.length / 1024).toFixed(0)}KB`,
  )
}

await browser.close()
console.log(
  `\n${sources.length} figures: ${(before / 1024 / 1024).toFixed(1)}MB -> ` +
    `${(after / 1024 / 1024).toFixed(2)}MB (${((1 - after / before) * 100).toFixed(0)}% smaller)`,
)
