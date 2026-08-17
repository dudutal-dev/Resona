/**
 * Turns the figure artwork into a point cloud the app can animate.
 *
 *   node scripts/extract-figure.mjs
 *
 * The source is a body of light: a filled, translucent figure threaded with
 * filaments and lit points, its colour running from red at the feet through the
 * spectrum to violet at the crown. Shipping the PNG would work, but it would be
 * half a megabyte that can only ever sit still, and it would be the first media
 * file in an app whose whole build is procedural. So the pixels are read once,
 * here, and reduced to points the app draws itself, every frame — which means it
 * can move them.
 *
 * Which pixels to keep is the whole problem, and brightness alone is the wrong
 * answer twice over. The figure is surrounded by a soft halo that is bright and
 * says nothing, and filled with an interior that is dim and says a great deal:
 * ribs, filaments, the lines down the arms. Taking the brightest pixels keeps
 * the halo and loses the anatomy.
 *
 * So each pixel is scored on how much it stands out from its immediate
 * surroundings — its own brightness minus a small blur of it — with only a
 * little weight on brightness itself. A halo gradient scores near zero however
 * bright it is; a filament one pixel wide scores high however faint. Points are
 * then taken from every cell of a coarse grid rather than globally, so the legs,
 * which the render draws much darker than the chest, are not dropped wholesale.
 *
 * Two things are kept per point beyond its position:
 *
 *   - Its hue. The artwork's colour is not decoration, it is the mapping: the
 *     spectrum up the body is the same order as the intervals of the scale, so
 *     the picture already knows which height belongs to which interval. The app
 *     rotates all of it to follow the frequency's accent, keeping the relations.
 *   - Whether it is a lit point rather than body. Those are found as local
 *     maxima that stand well clear of a wider blur — the stars in the figure,
 *     not the reflections off it — and the app flares them on their interval.
 */
import { inflateSync, gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = resolve(HERE, '../assets/figure-source.png')
const OUT = resolve(HERE, '../src/data/figure.json')

/** Below this a pixel is the black of the frame, or the outer edge of the halo. */
const MIN_LUMA = 40
/**
 * How much a pixel must stand out to be worth a point, and how the two terms are
 * weighed. Relief has to carry it, which is not what a first guess gives: with
 * brightness weighted at 0.3 anything over luma 87 cleared this bar on its own,
 * so three quarters of the body qualified and the grid below returned an even
 * dither of the whole silhouette instead of its structure.
 *
 * Measured across the 485,000 lit pixels of the source, relief runs p50 0, p90
 * 11.8, p99 32. At these weights a pixel needs a relief around eight to be kept,
 * which is the top seventh — edges, filaments and lit points, and none of the
 * flat interior.
 */
const MIN_SCORE = 28
const RELIEF_WEIGHT = 2
const LUMA_WEIGHT = 0.08
/** Blur applied before anything is measured, to take the render's noise out. */
const DENOISE_RADIUS = 1
/** Hue is averaged over this radius: colour varies slowly, noise does not. */
const HUE_RADIUS = 10
/** Radius of the blur the score is taken against, and of the wider one nodes must clear. */
const DETAIL_RADIUS = 3
const FIELD_RADIUS = 12
/** Points to aim for. Enough that the anatomy reads; see the note on `thin`. */
const TARGET_POINTS = 40000
/** Grid the points are spread over, in source pixels. */
const CELL = 3
/**
 * Coordinates are stored as integers, this many per image width — about 0.7
 * source pixels, finer than the dots drawn from them, and a third of the size
 * three decimal places would take.
 */
const SCALE = 1024

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

const { width, height, channels, pixels } = decodePng(readFileSync(SOURCE))
const area = width * height

// ------------------------------------------------------- brightness and hue
/**
 * Everything below is read off a slightly blurred copy of the image, and that is
 * not a detail.
 *
 * The source is a render carrying compression noise, and both things this script
 * measures are ruined by it. Relief taken pixel by pixel is mostly noise, so the
 * score stops preferring structure and the selection becomes an even dither over
 * the whole body — the anatomy vanishes into speckle. Hue is worse: where the
 * body is dark the three channels are nearly equal, so a hue taken from them is
 * whatever the noise decided, and a figure whose colour runs cleanly from red to
 * violet comes out as red, green and blue confetti.
 *
 * One pixel of blur removes both. It costs nothing that matters, because nothing
 * here is looking for detail finer than the dots it will be drawn with.
 */
function blurChannel(source, radius) {
  const span = radius * 2 + 1
  const pass = new Float32Array(area)
  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = 0
    for (let x = 0; x < radius && x < width; x++) sum += source[row + x]
    for (let x = 0; x < width; x++) {
      const add = x + radius
      const drop = x - radius - 1
      if (add < width) sum += source[row + add]
      if (drop >= 0) sum -= source[row + drop]
      pass[row + x] = sum / span
    }
  }
  const out = new Float32Array(area)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y < radius && y < height; y++) sum += pass[y * width + x]
    for (let y = 0; y < height; y++) {
      const add = y + radius
      const drop = y - radius - 1
      if (add < height) sum += pass[add * width + x]
      if (drop >= 0) sum -= pass[drop * width + x]
      out[y * width + x] = sum / span
    }
  }
  return out
}

const raw = [new Float32Array(area), new Float32Array(area), new Float32Array(area)]
for (let i = 0; i < area; i++) {
  const o = i * channels
  raw[0][i] = pixels[o]
  raw[1][i] = pixels[o + 1]
  raw[2][i] = pixels[o + 2]
}

const rgb = raw.map((c) => blurChannel(c, DENOISE_RADIUS))
const luma = new Float32Array(area)
for (let i = 0; i < area; i++) {
  const r = rgb[0][i]
  const g = rgb[1][i]
  const b = rgb[2][i]
  luma[i] = r > g ? (r > b ? r : b) : g > b ? g : b
}

/**
 * Hue, averaged as a direction rather than as a number.
 *
 * Blurring the three channels and then converting does not work, and the failure
 * is instructive: wherever the body is dark the blurred channels are still
 * nearly equal, so the hue angle they imply swings across the whole circle on
 * differences of one or two levels, and a figure whose colour runs cleanly from
 * red at the feet to violet at the crown comes out as red, green and blue
 * confetti. The average of 0° and 350° is not 175°.
 *
 * So each pixel becomes a chroma vector — the same plane hue is an angle in —
 * and *those* are blurred. A vector average weighs each pixel by how much colour
 * it actually has, so the strong local colour decides and the grey noise around
 * it cancels instead of voting.
 */
const chromaU = new Float32Array(area)
const chromaV = new Float32Array(area)
const ROOT3_OVER_2 = Math.sqrt(3) / 2
for (let i = 0; i < area; i++) {
  const r = raw[0][i]
  const g = raw[1][i]
  const b = raw[2][i]
  chromaU[i] = r - (g + b) / 2
  chromaV[i] = ROOT3_OVER_2 * (g - b)
}
const blurU = blurChannel(chromaU, HUE_RADIUS)
const blurV = blurChannel(chromaV, HUE_RADIUS)
const hue = new Uint16Array(area)
for (let i = 0; i < area; i++) {
  const deg = (Math.atan2(blurV[i], blurU[i]) * 180) / Math.PI
  hue[i] = Math.round((deg + 360) % 360) % 360
}

const detail = blurChannel(luma, DETAIL_RADIUS)
const field = blurChannel(luma, FIELD_RADIUS)

// ------------------------------------------------------------- point choice
/**
 * A lit point rather than body: a local maximum, near white, standing well clear
 * of the light around it. The margin is what separates a star from the bright
 * side of a filament, which is a local maximum too.
 */
function isNode(x, y) {
  const i = y * width + x
  if (luma[i] < 235 || luma[i] < field[i] + 45) return false
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (luma[i + dy * width + dx] > luma[i]) return false
    }
  }
  return true
}

const cells = new Map()
let lit = 0
let scored = 0
for (let y = 2; y < height - 2; y++) {
  for (let x = 2; x < width - 2; x++) {
    const i = y * width + x
    if (luma[i] < MIN_LUMA) continue
    lit++
    const relief = luma[i] - detail[i]
    const score = luma[i] * LUMA_WEIGHT + (relief > 0 ? relief : 0) * RELIEF_WEIGHT
    if (score < MIN_SCORE) continue
    scored++
    const key = ((y / CELL) | 0) * width + ((x / CELL) | 0)
    const point = { x, y, score, luma: luma[i], hue: hue[i], node: isNode(x, y) }
    const bucket = cells.get(key)
    if (bucket) bucket.push(point)
    else cells.set(key, [point])
  }
}

/**
 * Taken per cell, not globally.
 *
 * Sorting everything by score and keeping the top forty thousand returns the
 * chest and the face and almost nothing below the knee, because the render draws
 * the legs far darker. Taking the same share from every occupied cell keeps the
 * whole body, and inside each cell the score still decides which pixels.
 */
const perCell = Math.max(1, Math.round(TARGET_POINTS / cells.size))
const kept = []
for (const bucket of cells.values()) {
  bucket.sort((a, b) => b.score - a.score)
  for (let i = 0; i < perCell && i < bucket.length; i++) kept.push(bucket[i])
  // A node is worth a point wherever it falls, even if three brighter pixels in
  // its cell were taken first.
  for (let i = perCell; i < bucket.length; i++) if (bucket[i].node) kept.push(bucket[i])
}

let top = height
let bottom = 0
let left = width
let right = 0
for (const p of kept) {
  if (p.y < top) top = p.y
  if (p.y > bottom) bottom = p.y
  if (p.x < left) left = p.x
  if (p.x > right) right = p.x
}
const cx = (left + right) / 2
const cy = (top + bottom) / 2

// ----------------------------------------------------------------- output
/**
 * One flat array of integers: same numbers, none of the brackets, and it
 * compresses better because the values run in order down the image. Hue and kind
 * share a slot — the hue is stored to six bits, which is finer than the eye
 * separates on a point one pixel across, and the kind is the bit below it.
 *
 * Sixty-four buckets over the full turn, not sixty-three: hue is a circle, so the
 * last bucket has to wrap back onto the first. Dividing by 63 instead put the
 * reddest points at 360 degrees, which is the same colour but not the same
 * number, and anything that checks the range is right to complain.
 */
const flat = []
let nodes = 0
for (const p of kept) {
  if (p.node) nodes++
  flat.push(
    Math.round(((p.x - cx) / width) * SCALE),
    Math.round(((p.y - cy) / width) * SCALE),
    Math.round((p.luma / 255) * 63),
    (Math.round((p.hue / 360) * 64) % 64) * 2 + (p.node ? 1 : 0),
  )
}

/**
 * The cloud's own average hue, as a direction — so the app can rotate the whole
 * figure onto whatever accent the current frequency has, and keep every colour
 * relation inside it intact rather than flattening them to one colour.
 */
let meanU = 0
let meanV = 0
for (const p of kept) {
  const a = (p.hue * Math.PI) / 180
  meanU += Math.cos(a)
  meanV += Math.sin(a)
}
const baseHue = Math.round((((Math.atan2(meanV, meanU) * 180) / Math.PI) + 360) % 360)

const payload = {
  source: 'assets/figure-source.png',
  generated: 'scripts/extract-figure.mjs',
  width,
  height,
  scale: SCALE,
  /** The body's own extent, in the same units, so height can be mapped to interval. */
  top: Math.round(((top - cy) / width) * SCALE),
  bottom: Math.round(((bottom - cy) / width) * SCALE),
  count: kept.length,
  nodes,
  baseHue,
  p: flat,
}

writeFileSync(OUT, `${JSON.stringify(payload)}\n`)

const json = JSON.stringify(payload)
console.log(
  `figure: ${width}x${height}, ${lit} lit pixels, ${scored} with relief enough to score\n` +
    `  -> ${kept.length} points (${nodes} lit points), ${cells.size} cells at ${perCell} each\n` +
    `  body spans x ${left}-${right}, y ${top}-${bottom}; mean hue ${baseHue}deg\n` +
    `  ${(Buffer.byteLength(json) / 1024).toFixed(0)}KB, ${(gzipSync(json).length / 1024).toFixed(0)}KB gzipped; ` +
    `source PNG is ${(readFileSync(SOURCE).length / 1024).toFixed(0)}KB`,
)
