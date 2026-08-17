/**
 * Turns the figure artwork into a point cloud the app can animate.
 *
 *   node scripts/extract-figure.mjs
 *
 * The source is a 768x1408 render of a human silhouette drawn in starlight on
 * black, with concentric rings of light over the chest. Shipping that PNG would
 * work, but it would be a 530KB asset that can only ever sit still, and it would
 * be the first media file in an app whose whole build is procedural.
 *
 * So the pixels are read once, here, and reduced to points: position, brightness
 * and which part of the drawing each one belongs to. At runtime the app draws
 * those points itself, every frame, which means it can move them.
 *
 * Two things were learnt by measuring the artwork rather than looking at it, and
 * both shape everything below.
 *
 * The first: the rings are not decoration over a torso, they *are* the torso. A
 * radial histogram of all 59,000 lit pixels about the ring centre shows about
 * twenty-five evenly spaced peaks running from radius 30 out to 184, and nothing
 * underneath them. Deleting them, which was the obvious fix for a chest so
 * bright the body could not be seen through it, leaves a person with a hole in
 * the middle. So they are kept, labelled, and drawn compressed toward the centre
 * — the mass that was blocking the figure becomes a core that fits inside it.
 *
 * The second: the outermost ring is the only thing joining the arms and legs to
 * the body. Compress that one too and the limbs float. So the outer band is held
 * at full size as the torso's boundary and only the interior is compressed.
 *
 * Nothing here is a magic number typed in by eye: the centre is searched for, and
 * both radii are read off the histogram.
 */
import { inflateSync, gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(HERE, '../assets/figure-source.png')
const OUT = resolve(HERE, '../src/data/figure.json')

/** Pixels dimmer than this are compression noise in the render, not structure. */
const MIN_LUMA = 24
/**
 * Coordinates are stored as integers, this many per image width. That is 0.75
 * source pixels, which after the ~1.3x upscale onto a 4K frame is under a pixel
 * — finer than the dots being drawn, and it keeps the file a third of the size
 * that three decimal places would.
 */
const SCALE = 1024
/**
 * The interior rings are drawn at their own resolution, which is far denser than
 * anything else in the image and denser than it needs to be once it is
 * compressed to half size. Sampled down to this, the core stays continuous and
 * stops out-weighing the body.
 */
const CORE_POINTS = 11000

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

// --------------------------------------------------------------- lit pixels
const { width, height, channels, pixels } = decodePng(readFileSync(SOURCE))

const lit = []
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const o = (y * width + x) * channels
    const r = pixels[o]
    const g = pixels[o + 1]
    const b = pixels[o + 2]
    const luma = Math.max(r, g, b)
    if (luma < MIN_LUMA) continue
    lit.push({ x, y, r, g, b, luma })
  }
}

// ------------------------------------------------------------- ring centre
/**
 * Found, not typed in. A brightness-weighted centroid gets close — the core of
 * the rings is the brightest thing in the frame — but "close" is not good enough
 * when the next step is to histogram radii: a centre off by three pixels smears
 * every ring peak into its neighbours and the separation below stops working.
 *
 * So the centroid is only a seed. The real centre is the one that makes the
 * radial histogram as peaked as it can be, which is the sum of its squared bin
 * counts; a coarse pass then a fine one finds it in about a tenth of a second.
 */
function peakiness(cx, cy) {
  const counts = new Int32Array(400)
  for (const p of lit) {
    const r = Math.hypot(p.x - cx, p.y - cy) | 0
    if (r < 400) counts[r]++
  }
  let score = 0
  for (let i = 20; i < 260; i++) score += counts[i] * counts[i]
  return score
}

let seedX = 0
let seedY = 0
let mass = 0
for (const p of lit) {
  const weight = Math.pow(p.luma / 255, 4)
  seedX += p.x * weight
  seedY += p.y * weight
  mass += weight
}
seedX = Math.round(seedX / mass)
seedY = Math.round(seedY / mass)

let cx = seedX
let cy = seedY
for (const step of [4, 1]) {
  let best = peakiness(cx, cy)
  const fromX = cx
  const fromY = cy
  for (let dy = -5 * step; dy <= 5 * step; dy += step) {
    for (let dx = -5 * step; dx <= 5 * step; dx += step) {
      const score = peakiness(fromX + dx, fromY + dy)
      if (score > best) {
        best = score
        cx = fromX + dx
        cy = fromY + dy
      }
    }
  }
}

// ------------------------------------------------------- reading the radii
const counts = new Int32Array(400)
for (const p of lit) {
  const r = Math.hypot(p.x - cx, p.y - cy) | 0
  if (r < 400) counts[r]++
}
/** Well outside the rings, so this is the body outline's own density. */
const background = (() => {
  const window = []
  for (let r = 230; r < 330; r++) window.push(counts[r])
  window.sort((a, b) => a - b)
  return window[window.length >> 1]
})()

/** The last radius still carrying a ring, i.e. the edge of the torso. */
let ringMax = 0
for (let r = 20; r < 260; r++) if (counts[r] > background * 2.5) ringMax = r

/**
 * The outermost band is the boundary the limbs attach to, so it is held at full
 * size. Thirteen pixels is a little under two ring spacings — enough to take the
 * whole outer stroke including the blur around it, not enough to take the ring
 * inside it as well.
 */
const shellInner = ringMax - 13
const coreOuter = ringMax + 2

// --------------------------------------------------------------- sampling
/** 0 body outline, 1 the torso boundary, 2 the interior rings. */
const kindOf = (r) => (r >= coreOuter ? 0 : r >= shellInner ? 1 : 2)

const groups = [[], [], []]
for (const p of lit) {
  const r = Math.hypot(p.x - cx, p.y - cy)
  groups[kindOf(r)].push(p)
}

/**
 * The body and the boundary are kept whole — they are thin lines, so every lit
 * pixel is detail, and throwing any of them away is what made the first attempt
 * look like dust instead of a drawing. Only the filled interior is thinned, and
 * that on a grid rather than by brightness, so the sample stays even instead of
 * collapsing onto the brightest few rings.
 */
function thin(points, target) {
  if (points.length <= target) return points
  const CELL = 4
  const cells = new Map()
  for (const p of points) {
    const key = `${(p.x / CELL) | 0}:${(p.y / CELL) | 0}`
    const bucket = cells.get(key)
    if (bucket) bucket.push(p)
    else cells.set(key, [p])
  }
  const perCell = Math.max(1, Math.round(target / cells.size))
  const kept = []
  for (const bucket of cells.values()) {
    bucket.sort((a, b) => b.luma - a.luma)
    for (let i = 0; i < Math.min(perCell, bucket.length); i++) kept.push(bucket[i])
  }
  return kept
}

const kept = [...groups[0], ...groups[1], ...thin(groups[2], CORE_POINTS)]

let maxRadius = 0
for (const p of kept) maxRadius = Math.max(maxRadius, Math.hypot(p.x - cx, p.y - cy))

// ----------------------------------------------------------------- output
/**
 * One flat array of integers rather than an array of arrays: same numbers, none
 * of the brackets, and it compresses better because the values run in sorted
 * order down the image. Positions are relative to the ring centre and scaled to
 * the image width, so the renderer never needs to know the source resolution.
 */
const flat = []
for (const p of kept) {
  const r = Math.hypot(p.x - cx, p.y - cy)
  flat.push(
    Math.round(((p.x - cx) / width) * SCALE),
    Math.round(((p.y - cy) / width) * SCALE),
    Math.round((p.luma / 255) * 63),
    kindOf(r),
  )
}

const payload = {
  source: 'assets/figure-source.png',
  generated: 'scripts/extract-figure.mjs',
  width,
  height,
  scale: SCALE,
  /** Everything below is in the same units as the coordinates. */
  shellInner: Math.round((shellInner / width) * SCALE),
  coreOuter: Math.round((coreOuter / width) * SCALE),
  maxRadius: Math.round((maxRadius / width) * SCALE),
  count: kept.length,
  p: flat,
}

writeFileSync(OUT, `${JSON.stringify(payload)}\n`)

const json = JSON.stringify(payload)
console.log(
  `figure: centre (${cx}, ${cy}) from seed (${seedX}, ${seedY}); ` +
    `background ${background}/radius, rings out to ${ringMax}, boundary ${shellInner}-${coreOuter}\n` +
    `  ${lit.length} lit pixels -> ${kept.length} points ` +
    `(${groups[0].length} body, ${groups[1].length} boundary, ` +
    `${groups[2].length} interior thinned to ${kept.length - groups[0].length - groups[1].length})\n` +
    `  ${(Buffer.byteLength(json) / 1024).toFixed(0)}KB, ` +
    `${(gzipSync(json).length / 1024).toFixed(0)}KB gzipped; ` +
    `source PNG is ${(readFileSync(SOURCE).length / 1024).toFixed(0)}KB`,
)
