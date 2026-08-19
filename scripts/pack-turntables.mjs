/**
 * Transcodes turntable footage into what the app actually ships.
 *
 *   npm i -D ffmpeg-static      (once, if the machine has no ffmpeg)
 *   node scripts/pack-turntables.mjs
 *
 * A turntable is a clip of a figure making one full revolution against a locked
 * camera. The stage plays it as a loop and drives its rate from the session, so
 * the figure turns on the music's own clock — see `TurntableField`.
 *
 * Two clips of the same figure are expected, named by the shape of the screen
 * they are for:
 *
 *   assets/turntables/figure-portrait.mp4   a phone held upright
 *   assets/turntables/figure-wide.mp4       a phone turned, or a television
 *
 * Four things about the encode are deliberate.
 *
 * **The audio track is stripped.** A second media element with audio contends
 * for the system's Now Playing session, and on iOS the route follows whichever
 * element wins — which is how a silent element once silenced casting. See the
 * note at the top of `MediaRoute`. No audio track, no contention.
 *
 * **The clip is stretched with real intermediate frames.** This is the
 * important one. A revolution here takes twenty to sixty seconds because it is
 * locked to the music, and the source is ten seconds long — so the element
 * plays at roughly a third speed, holding each frame for an eighth of a second.
 * Eight frames a second reads as a slideshow of a turning figure rather than as
 * a turning figure. `minterpolate` synthesises the frames in between, so a
 * twenty-four-second clip played over a twenty-four-second revolution runs at
 * its own twenty-four. The frame count nearly triples and the encoder cannot
 * compress synthesised frames as cheaply as real ones, so the quality settings
 * below are pulled down to pay for it.
 *
 * **H.264 only.** The earlier pass shipped VP9/WebM alongside on the argument
 * that it would be smaller everywhere that is not iOS. Measured twice, at two
 * different resolutions, it came out *larger* than the H.264 it was supposed to
 * undercut — so it was paying for a second copy of every clip and getting
 * nothing. H.264 is also what the phone this was built for decodes in hardware.
 *
 * **`+faststart`.** The index goes first so playback can begin before the whole
 * file has arrived, which matters because these are fetched on demand rather
 * than precached.
 *
 * The encoded files are committed, so a normal build never runs this. If ffmpeg
 * is missing the script says so and changes nothing.
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = resolve(HERE, '../assets/turntables')
const OUT_DIR = resolve(HERE, '../src/assets/turntables')

/**
 * Seconds one revolution lasts after stretching. Chosen against the two cases
 * that actually occur — a club engine at 16 bars is about 31 seconds, the
 * ambient engine at 24 notes about 22 — so both land near a playback rate of 1
 * and run at something close to the clip's own frame rate.
 *
 * Every second here is paid for twice, in bytes and in encode time, and the
 * gain flattens out: past this the rate is already above 1 for most of the
 * range and the extra frames are never seen.
 */
const TARGET_SECONDS = 24
const FPS = 24
/**
 * Height, per orientation, and the quality. Both sources are 720p on their
 * short edge, so nothing here upscales.
 *
 * These are lower than they look like they should be, and that is the trade
 * this file exists to make: interpolation triples the frame count, so at the
 * settings the five-second clips used the pair came to 5.6MB. The figure is a
 * slow silhouette against black seen from across a room — it survives crf 35
 * far better than a detailed still would.
 */
const PORTRAIT_HEIGHT = 900
const WIDE_HEIGHT = 660
const CRF = 35

function findFfmpeg() {
  const fromEnv = process.env.FFMPEG_PATH
  if (fromEnv && existsSync(fromEnv)) return fromEnv
  // Looked for beside this script and beside whatever directory it was run
  // from, since the machine that has ffmpeg may not be this project.
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
    [
      'No ffmpeg available, so nothing was changed.',
      '',
      'The encoded turntables are committed, so a normal build never needs this.',
      'To re-encode after changing the footage, install one of:',
      '',
      '  npm i -D ffmpeg-static      (a binary, no system install)',
      '  apt install ffmpeg          (or your platform equivalent)',
      '',
      'or point FFMPEG_PATH at one you already have.',
    ].join('\n'),
  )
  process.exit(1)
}

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args])
const kb = (p) => `${Math.round(statSync(p).size / 1024)}KB`

/** Seconds of video, read back from the container. */
function duration(file) {
  // ffprobe is not shipped with ffmpeg-static, so this asks ffmpeg itself and
  // reads the duration off the stream summary it prints to stderr.
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
if (sources.length === 0) {
  console.error(`No footage in ${SOURCE_DIR}`)
  process.exit(1)
}
mkdirSync(OUT_DIR, { recursive: true })

for (const file of sources.sort()) {
  const stem = file.replace(/\.[^.]+$/, '')
  const input = join(SOURCE_DIR, file)
  const out = join(OUT_DIR, `${stem}.mp4`)
  const height = /wide/i.test(stem) ? WIDE_HEIGHT : PORTRAIT_HEIGHT

  const seconds = duration(input)
  const stretch = TARGET_SECONDS / seconds
  // Interpolate up to `stretch` times the frame rate first, then slow the
  // presentation timestamps by the same factor: every frame of the result is
  // either a source frame or one synthesised between two of them, and none is
  // repeated.
  const filter = [
    `scale=-2:${height}`,
    `minterpolate=fps=${Math.round(FPS * stretch)}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`,
    `setpts=${stretch.toFixed(4)}*PTS`,
  ].join(',')

  run([
    '-i', input, '-an',
    '-vf', filter,
    '-r', String(FPS),
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', String(CRF), '-preset', 'slow', '-g', String(FPS * 2),
    '-movflags', '+faststart',
    out, '-y',
  ])

  console.log(
    `${stem}  ${kb(input)} / ${seconds.toFixed(1)}s in  →  ${kb(out)} / ${TARGET_SECONDS}s at ${height}p`,
  )
}
