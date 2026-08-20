/**
 * Transcodes a drifting clip into what the app ships.
 *
 *   node scripts/pack-clips.mjs
 *
 * A **clip** is not a turntable. A turntable is one revolution against a locked
 * camera, stretched and interpolated so it can be played at whatever rate the
 * music asks for; see `pack-turntables.mjs`. A clip is footage that simply
 * moves — a camera drifting past a figure — and the stage loops it at a rate
 * near its own, so none of that stretching applies and none of its cost is
 * paid.
 *
 * Sources live in `assets/clips`, one file per figure.
 *
 * Three things about the encode are deliberate.
 *
 * **The audio track is stripped**, for the reason given at the top of
 * `pack-turntables.mjs`: a second element with audio contends for the system's
 * Now Playing session, and on iOS the route follows whichever wins.
 *
 * **The loop is closed with a crossfade.** Footage generated from a prompt
 * begins and ends near the same frame but not on it, and a cut every ten
 * seconds is the one thing a person staring at a screen will notice. The tail
 * is dissolved into the head, which costs the length of the fade and buys a
 * loop with no seam in it.
 *
 * **A higher quality than the turntables.** Those are a silhouette against
 * black at crf 35; this is a planet, a nebula and a gown, all smooth gradient,
 * where the same setting bands visibly.
 *
 * A still is written beside the clip for the picker, because a `<video>` is not
 * a thumbnail — on iOS it paints nothing until it has played.
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = resolve(HERE, '../assets/clips')
const OUT_DIR = resolve(HERE, '../src/assets/clips')

/** Tall enough for a television, small enough to fetch on a phone. */
const HEIGHT = 720
const CRF = 30
const FPS = 24
/** How long the tail takes to dissolve into the head. */
const LOOP_FADE_SECONDS = 0.9
const POSTER_AT_SECONDS = 0.5
const POSTER_HEIGHT = 480
const POSTER_QUALITY = 74

function findFfmpeg() {
  const fromEnv = process.env.FFMPEG_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  for (const base of [import.meta.url, `file://${join(process.cwd(), 'package.json')}`]) {
    try {
      return createRequire(base)('ffmpeg-static')
    } catch {
      /* keep looking */
    }
  }
  try {
    return execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim() || null
  } catch {
    return null
  }
}

const ffmpeg = findFfmpeg()
if (!ffmpeg) {
  console.error(
    'No ffmpeg available, so nothing was changed. The encoded clips are committed,\n' +
      'so a normal build never needs this. Install `ffmpeg-static`, or point\n' +
      'FFMPEG_PATH at an ffmpeg you already have.',
  )
  process.exit(1)
}

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args])
const kb = (p) => `${Math.round(statSync(p).size / 1024)}KB`

function duration(file) {
  let out = ''
  try {
    execFileSync(ffmpeg, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] })
  } catch (err) {
    out = String(err.stderr ?? '')
  }
  const m = out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/)
  if (!m) throw new Error(`could not read the duration of ${file}`)
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
}

const sources = readdirSync(SOURCE_DIR).filter((f) => /\.(mp4|mov|webm|m4v)$/i.test(f))
if (!sources.length) {
  console.error(`No footage in ${SOURCE_DIR}`)
  process.exit(1)
}
mkdirSync(OUT_DIR, { recursive: true })

for (const file of sources.sort()) {
  const stem = file.replace(/\.[^.]+$/, '')
  const input = join(SOURCE_DIR, file)
  const out = join(OUT_DIR, `${stem}.mp4`)
  const seconds = duration(input)
  const fade = Math.min(LOOP_FADE_SECONDS, seconds / 4)
  const body = seconds - fade

  // The body, then the tail dissolved over the start of it. `xfade` returns
  // first + second - duration, so the result is exactly `body` long and its
  // last frame runs into its first.
  const graph = [
    `[0:v]scale=-2:${HEIGHT},fps=${FPS},split=2[a][b]`,
    // `fps` again after each trim: xfade refuses inputs whose frame rate it
    // cannot see, and trimming loses it.
    `[a]trim=0:${body.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS}[main]`,
    `[b]trim=${body.toFixed(3)}:${seconds.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS}[tail]`,
    `[tail][main]xfade=transition=fade:duration=${fade.toFixed(3)}:offset=0[v]`,
  ].join(';')

  run([
    '-i', input, '-an',
    '-filter_complex', graph, '-map', '[v]',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', String(CRF), '-preset', 'slow', '-g', String(FPS * 2),
    '-movflags', '+faststart',
    out, '-y',
  ])

  const poster = join(OUT_DIR, `${stem}-poster.webp`)
  run([
    '-ss', String(POSTER_AT_SECONDS), '-i', input,
    '-frames:v', '1',
    '-vf', `scale=-2:${POSTER_HEIGHT}`,
    '-c:v', 'libwebp', '-quality', String(POSTER_QUALITY),
    poster, '-y',
  ])

  console.log(
    `${stem}  ${kb(input)} / ${seconds.toFixed(1)}s  →  ${kb(out)} / ${body.toFixed(1)}s at ${HEIGHT}p` +
      `, ${fade.toFixed(1)}s loop fade, poster ${kb(poster)}`,
  )
}
