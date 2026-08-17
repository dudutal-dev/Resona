/**
 * Builds Resona as ONE self-contained .html file.
 *
 * Everything — JS, CSS, the favicon — is inlined, so the result needs no
 * server, no install and no build step from whoever opens it. Useful for
 * sending the app to yourself, dropping it on any static host, or just
 * double-clicking it.
 *
 *   npm run build:single      ->  dist-single/resona.html
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'dist-single')
const ASSETS = join(OUT_DIR, 'assets')

console.log('› building…')
execFileSync('npx', ['vite', 'build'], {
  cwd: ROOT,
  env: { ...process.env, SINGLE_FILE: '1' },
  stdio: 'inherit',
})

const assetFiles = readdirSync(ASSETS)
const jsFiles = assetFiles.filter((f) => f.endsWith('.js'))
const cssFiles = assetFiles.filter((f) => f.endsWith('.css'))
/**
 * Exactly one of each, and it is worth failing loudly over. This once found the
 * first `.js` by name and inlined it: when the app started code-splitting, that
 * was the lazy chunk rather than the entry, and the build produced a half
 * megabyte of HTML that did nothing at all.
 */
if (jsFiles.length !== 1 || cssFiles.length !== 1) {
  throw new Error(
    `expected exactly one JS and one CSS asset, found [${jsFiles}] and [${cssFiles}] — ` +
      'the single-file build must not code-split',
  )
}
const [jsFile] = jsFiles
const [cssFile] = cssFiles

const js = readFileSync(join(ASSETS, jsFile), 'utf8')
const css = readFileSync(join(ASSETS, cssFile), 'utf8')
const favicon = readFileSync(join(ROOT, 'public/icons/icon.svg'), 'utf8')

let html = readFileSync(join(OUT_DIR, 'index.html'), 'utf8')

// A closing tag inside a JS string would end the script element early.
const safeJs = js.replace(/<\/script/gi, '<\\/script')

/**
 * Always replace via a function. Minified bundles are full of `$&`, `` $` ``
 * and `$1`, which a string replacement would expand as match references and
 * splice the original tag back into the output.
 */
const sub = (source, pattern, replacement) => source.replace(pattern, () => replacement)

// Small head edits first: once the bundle is inlined, any later pattern would
// be scanning half a megabyte of JS that contains markup-shaped strings.
html = sub(
  html,
  /<link rel="icon"[^>]*>/,
  `<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}" />`,
)
// No manifest or apple-touch-icon: both point at files this build does not ship.
html = sub(html, /<link rel="manifest"[^>]*>/, '')
html = sub(html, /<link rel="apple-touch-icon"[^>]*>/, '')
html = sub(html, /<link[^>]*rel="stylesheet"[^>]*>/, `<style>${css}</style>`)
html = sub(html, /<script[^>]*src="[^"]*"[^>]*><\/script>/, `<script type="module">${safeJs}</script>`)

if (/assets\/index-/.test(html)) throw new Error('an external asset reference survived inlining')

const outFile = join(OUT_DIR, 'resona.html')
writeFileSync(outFile, html)

// Leave only the single file behind.
rmSync(ASSETS, { recursive: true, force: true })
rmSync(join(OUT_DIR, 'index.html'), { force: true })

console.log(`\n✓ dist-single/resona.html — ${(html.length / 1024).toFixed(0)} kB, single file`)
