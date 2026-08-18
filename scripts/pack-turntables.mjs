/**
 * Transcodes turntable footage into what the app actually ships.
 *
 *   node scripts/pack-turntables.mjs
 *
 * A turntable is a short clip of a figure making one full revolution, shot
 * against a locked camera. The stage plays it as a loop and drives its rate
 * from the session, so the figure turns in time with the brainwave layer — see
 * `TurntableField`.
 *
 * The sources in `assets/turntables` come off a phone at around 12Mbit and
 * eight megabytes for five seconds, which is not something to put in an app.
 * They are re-encoded here to roughly a tenth of that, and two things about
 * the encode are deliberate:
 *
 * - **The audio track is stripped.** A second media element with audio would
 *   contend for the system's Now Playing session, and on iOS the route follows
 *   whichever element wins — which is how a silent element once silenced
 *   casting. See the note at the top of `MediaRoute`. No audio track, no
 *   contention.
 * - **Two containers.** H.264 is what iOS decodes in hardware and is what a
 *   phone will actually play; VP9/WebM is smaller and is what every other
 *   browser — including the headless one these are verified in — will pick.
 *   A browser downloads only the source it selects, so nobody pays for both.
 *
 * There is no ffmpeg in this project's dependencies and no reason to add one to
 * a normal build: the encoded files are committed, so this only has to run when
 * footage changes. If ffmpeg is missing the script says so and changes nothing.
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
 * 900px tall at crf 30. Checked against the source frame by frame on the darker
 * of the two clips, which is the one that would band first: no visible
 * difference, at a third of the bytes of crf 26.
 *
 * VP9's scale is not x264's — at crf 36 it came out twice the size of the H.264
 * it was supposed to undercut. 44 is where it lands beside it.
 */
const HEIGHT = 900
const CRF_H264 = 30
const CRF_VP9 = 44

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

const sources = readdirSync(SOURCE_DIR).filter((f) => /\.(mp4|mov|webm|m4v)$/i.test(f))
if (sources.length === 0) {
  console.error(`No footage in ${SOURCE_DIR}`)
  process.exit(1)
}
mkdirSync(OUT_DIR, { recursive: true })

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args])
const kb = (p) => `${Math.round(statSync(p).size / 1024)}KB`

for (const file of sources.sort()) {
  const stem = file.replace(/\.[^.]+$/, '')
  const input = join(SOURCE_DIR, file)
  const mp4 = join(OUT_DIR, `${stem}.mp4`)
  const webm = join(OUT_DIR, `${stem}.webm`)

  // `-an` is the no-audio flag; see the note above about the Now Playing session.
  // `+faststart` puts the index first so playback can begin before the whole
  // file has arrived, which matters when these are fetched on demand.
  run([
    '-i', input, '-an',
    '-vf', `scale=-2:${HEIGHT}`,
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-crf', String(CRF_H264), '-preset', 'slow', '-g', '30',
    '-movflags', '+faststart',
    mp4, '-y',
  ])

  run([
    '-i', input, '-an',
    '-vf', `scale=-2:${HEIGHT}`,
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p',
    '-crf', String(CRF_VP9), '-b:v', '0', '-row-mt', '1', '-deadline', 'good',
    webm, '-y',
  ])

  console.log(`${stem}  ${kb(input)} in  →  ${kb(mp4)} mp4, ${kb(webm)} webm`)
}
