/**
 * Turns the figure artwork into a point cloud the app can animate.
 *
 *   node scripts/extract-figure.mjs
 *
 * The source is a 768x1408 render of a human silhouette drawn in starlight on
 * black, with concentric rings of light around the chest. Shipping that PNG
 * would work, but it would be a 530KB asset that can only ever sit still, and
 * it would be the first media file in an app whose whole build is procedural.
 *
 * So the pixels are read once, here, and reduced to a few thousand points:
 * position, brightness, and the radius each point sits at relative to the
 * centre of the rings. At runtime the app draws those points itself, which
 * means it can move them — the figure breathes, the shells expand on their own
 * harmonic, the whole thing reacts to the audio. A picture cannot do that.
 *
 * The output is ~14x smaller than the PNG and contains no image at all.
 */
import { inflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(HERE, '../assets/figure-source.png')
const OUT = resolve(HERE, '../src/data/figure.json')

/** How many points to keep. Enough to read as a body, few enough to draw at 60fps. */
const TARGET_POINTS = 9500
/** Pixels dimmer than this are noise in the render, not structure. */
const MIN_LUMA = 30

// ------------------------------------------------------------- PNG decoding
function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let offset = 8
  let width = 0
  let height = 0
  let colourType = 0
  let bitDepth = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colourType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
  }
  if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType]
  if (!channels) throw new Error(`unsupported colour type ${colourType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(stride * height)
  let pos = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]
    const line = raw.subarray(pos, pos + stride)
    pos += stride
    const row = out.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= channels ? prev[x - channels] : 0
      let value = line[x]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      row[x] = value & 0xff
    }
  }
  return { width, height, channels, pixels: out }
}

// ------------------------------------------------------------- point sampling
const { width, height, channels, pixels } = decodePng(readFileSync(SOURCE))

const candidates = []
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const o = (y * width + x) * channels
    const r = pixels[o]
    const g = pixels[o + 1]
    const b = pixels[o + 2]
    const luma = Math.max(r, g, b)
    if (luma < MIN_LUMA) continue
    candidates.push({ x, y, r, g, b, luma })
  }
}

/**
 * Keep the brightest points, but spread them.
 *
 * Taking the top N by brightness alone would return the head and the ring
 * strokes and drop the legs entirely, because the render is much dimmer there.
 * Sorting inside a coarse grid and taking a share from every occupied cell
 * keeps the whole body present.
 */
const CELL = 6
const cells = new Map()
for (const p of candidates) {
  const key = `${(p.x / CELL) | 0}:${(p.y / CELL) | 0}`
  const bucket = cells.get(key)
  if (bucket) bucket.push(p)
  else cells.set(key, [p])
}
const perCell = Math.max(1, Math.round(TARGET_POINTS / cells.size))
const chosen = []
for (const bucket of cells.values()) {
  bucket.sort((a, b) => b.luma - a.luma)
  for (let i = 0; i < Math.min(perCell, bucket.length); i++) chosen.push(bucket[i])
}

// ------------------------------------------------------------- ring geometry
/**
 * The centre of the concentric rings, found rather than typed in: it is the
 * brightest small region of the image, which is the core the rings radiate
 * from. Every point's radius from here becomes its shell index at runtime, so
 * the rings the artwork already contains can each breathe on a different
 * interval instead of being a flat backdrop.
 */
let cx = 0
let cy = 0
let mass = 0
for (const p of chosen) {
  const weight = Math.pow(p.luma / 255, 4)
  cx += p.x * weight
  cy += p.y * weight
  mass += weight
}
cx /= mass
cy /= mass

let maxRadius = 0
for (const p of chosen) {
  maxRadius = Math.max(maxRadius, Math.hypot(p.x - cx, p.y - cy))
}

// ------------------------------------------------------------------- output
/**
 * Coordinates are normalised to the image's short side and centred on the ring
 * centre, so the renderer can place the figure at any size without knowing the
 * source resolution. Everything is rounded to three decimals — at the sizes
 * this is drawn, more precision is bytes with no pixels behind them.
 */
const round = (n) => Math.round(n * 1000) / 1000
const points = chosen.map((p) => {
  const dx = (p.x - cx) / width
  const dy = (p.y - cy) / width
  return [
    round(dx),
    round(dy),
    Math.round((p.luma / 255) * 100) / 100,
    // Blue-white body dust versus the coloured ring strokes: the renderer tints
    // them differently so the body stays silver and the shells take the accent.
    p.g > p.r && p.g > p.b ? 1 : p.b > p.g && p.r > p.g ? 2 : 0,
  ]
})

const payload = {
  source: 'assets/figure-source.png',
  generated: 'scripts/extract-figure.mjs',
  width,
  height,
  centre: [round(cx / width), round(cy / width)],
  maxRadius: round(maxRadius / width),
  count: points.length,
  points,
}

writeFileSync(OUT, `${JSON.stringify(payload)}\n`)

const bytes = Buffer.byteLength(JSON.stringify(payload))
console.log(
  `figure: ${candidates.length} lit pixels -> ${points.length} points ` +
    `(${(bytes / 1024).toFixed(0)}KB, source PNG is ${(readFileSync(SOURCE).length / 1024).toFixed(0)}KB)`,
)
