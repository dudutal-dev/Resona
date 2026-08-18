import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * `SINGLE_FILE=1` produces one self-contained .html with every asset inlined:
 * no server, no install, no build step for the person opening it — just a file
 * that runs anywhere, including straight from disk. The service worker is left
 * out of that target because a single file has nothing to precache.
 */
const singleFile = process.env.SINGLE_FILE === '1'

/**
 * The build stamp shown on the About screen.
 *
 * Whether the phone is running what the repository holds is not a question you
 * can answer by looking at the app — a stale service worker looks exactly like
 * a fresh one. The commit is the only identifier that settles it, so it is read
 * at build time and printed where it can be compared against `git log`.
 *
 * `git` may be absent (a tarball, a clean CI checkout without history); the
 * build must not fail over a caption, so it degrades to the version alone.
 */
function buildStamp(): string {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string
  }
  let commit = ''
  try {
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    commit = 'nogit'
  }
  const day = new Date().toISOString().slice(0, 10)
  return `${pkg.version} · ${commit} · ${day}`
}

export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(buildStamp()) },
  plugins: [
    react(),
    !singleFile &&
      VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'audio/ambience/*'],
      manifest: {
        name: 'Resona — תדרים ומסעות',
        short_name: 'Resona',
        description:
          'מלודיות גנרטיביות המולחנות סביב תדר יעד — סולפג׳יו, ביינאורל ו-432Hz, עם מיקסר שכבות ומסעות מודרכים.',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#05030e',
        theme_color: '#05030e',
        categories: ['health', 'lifestyle', 'music'],
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        /**
         * `webp` and `glb` are here because they were missing, and the app is
         * offline-first: the six figure artworks are WebP and the 3D scene's
         * model is a GLB, so none of them were being precached. Online nobody
         * would notice — the browser just fetches them. Offline, television mode
         * showed the wash and the orbits around an empty middle, and the scene
         * loaded its code and then had no model to draw. An extension list is a
         * quiet way to break a feature: nothing errors at build time, and the
         * only symptom is on the one device that has already gone offline.
         */
        globPatterns: ['**/*.{js,css,html,ico,png,webp,svg,glb,woff2,json,mp3,ogg,wav}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
      }),
  ].filter(Boolean),
  build: singleFile
    ? {
        outDir: 'dist-single',
        assetsInlineLimit: 100 * 1024 * 1024,
        // One chunk, or there is nothing single about the file. The app splits
        // the television stage out with a dynamic import, and without this the
        // bundler emits it beside the entry — which the inliner then has to
        // guess between, and it guessed wrong.
        rollupOptions: { output: { inlineDynamicImports: true } },
      }
    : {},
  resolve: singleFile
    ? { alias: { 'virtual:pwa-register': fileURLToPath(new URL('./src/lib/pwa-noop.ts', import.meta.url)) } }
    : {},
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as any)
