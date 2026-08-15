/**
 * Renders the Resona app icons as PNGs.
 *
 * Written as a tiny procedural renderer + PNG encoder on top of `zlib` rather
 * than pulling in a native image dependency: the icon is a radial glow with
 * concentric rings, which is cheaper to draw directly than to rasterise.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([len, typeAndData, crc])
}

/** Encodes an RGBA buffer (size*size*4) as a PNG. */
function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = size * 4
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// -------------------------------------------------------------------- Renderer
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v))
const mix = (a, b, t) => a + (b - a) * t
/** Soft edge so rings and discs are anti-aliased instead of stair-stepped. */
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

/**
 * @param size    pixel dimension
 * @param padding fraction of the canvas kept empty around the art — maskable
 *                icons need a wide safe zone, regular ones do not.
 */
function renderIcon(size, { padding = 0.06, rounded = true } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const art = (size / 2) * (1 - padding)
  const corner = size * 0.22

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const dx = x - cx + 0.5
      const dy = y - cy + 0.5
      const d = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)

      // --- Background: deep violet-to-black vertical wash ---
      const t = y / size
      let r = mix(18, 5, t)
      let g = mix(10, 3, t)
      let b = mix(46, 14, t)

      // --- Core glow ---
      const glow = Math.exp(-Math.pow(d / (art * 0.55), 2)) * 1.15
      const [gr, gg, gb] = hslToRgb(268 + (d / art) * 45, 0.92, 0.62)
      r = mix(r, gr, clamp(glow))
      g = mix(g, gg, clamp(glow))
      b = mix(b, gb, clamp(glow))

      // --- Bright centre ---
      const core = smooth(art * 0.2, art * 0.02, d)
      r = mix(r, 255, core * 0.92)
      g = mix(g, 246, core * 0.92)
      b = mix(b, 255, core * 0.92)

      // --- Concentric resonance rings ---
      for (let k = 1; k <= 3; k++) {
        const ringR = art * (0.34 + k * 0.185)
        const w = art * 0.022
        const ring = smooth(w, 0, Math.abs(d - ringR))
        // Rings fade toward the bottom, which reads as a light source above.
        const fade = 0.85 - 0.35 * clamp((dy / art + 1) / 2)
        const [rr, rg, rb] = hslToRgb(272 + k * 26, 1, 0.78)
        const a = ring * fade * (1 - k * 0.16)
        r = mix(r, rr, a)
        g = mix(g, rg, a)
        b = mix(b, rb, a)
      }

      // --- Waveform arc: a sine traced around the outer ring ---
      const waveR = art * 0.84 + Math.sin(angle * 6) * art * 0.035
      const wave = smooth(art * 0.02, 0, Math.abs(d - waveR))
      const [wr, wg, wb] = hslToRgb(300, 1, 0.8)
      r = mix(r, wr, wave * 0.5)
      g = mix(g, wg, wave * 0.5)
      b = mix(b, wb, wave * 0.5)

      // --- Alpha / shape ---
      let alpha = 255
      if (rounded) {
        // Signed distance to a rounded box: negative inside, positive outside.
        // Rounding only the corners, unlike a naive per-axis test which also
        // eats into the straight edges.
        const qx = Math.abs(dx) - size / 2 + corner
        const qy = Math.abs(dy) - size / 2 + corner
        const dist =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - corner
        alpha = 255 * (1 - smooth(-0.75, 0.75, dist))
      }

      buf[i] = clamp(r, 0, 255)
      buf[i + 1] = clamp(g, 0, 255)
      buf[i + 2] = clamp(b, 0, 255)
      buf[i + 3] = alpha
    }
  }
  return buf
}

// ------------------------------------------------------------------------ Main
mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, opts: { padding: 0.08 } },
  { file: 'icon-512.png', size: 512, opts: { padding: 0.08 } },
  // Maskable icons get cropped to a circle by some launchers; 20% padding keeps
  // the rings inside the guaranteed safe zone.
  { file: 'icon-maskable-512.png', size: 512, opts: { padding: 0.2, rounded: false } },
  { file: 'apple-touch-icon.png', size: 180, opts: { padding: 0.08, rounded: false } },
]

for (const { file, size, opts } of targets) {
  const png = encodePNG(renderIcon(size, opts), size)
  writeFileSync(resolve(OUT_DIR, file), png)
  console.log(`✓ ${file} (${size}×${size}, ${(png.length / 1024).toFixed(1)} kB)`)
}

// A vector favicon for browsers that prefer one.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff8ff"/>
      <stop offset="35%" stop-color="#a98bff"/>
      <stop offset="100%" stop-color="#3a1a8f" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#150e2e"/>
      <stop offset="100%" stop-color="#05030e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="150" fill="url(#core)"/>
  <g fill="none" stroke="#c9b3ff" stroke-width="4" opacity="0.75">
    <circle cx="256" cy="256" r="96"/>
    <circle cx="256" cy="256" r="140" opacity="0.6"/>
    <circle cx="256" cy="256" r="184" opacity="0.4"/>
  </g>
  <circle cx="256" cy="256" r="34" fill="#fff"/>
</svg>
`
writeFileSync(resolve(OUT_DIR, 'icon.svg'), svg)
console.log('✓ icon.svg')
