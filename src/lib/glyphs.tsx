import type { Frequency } from './types'
import type { JourneyTheme } from './themes'

/**
 * Line-drawn marks, one per kind of thing the app holds.
 *
 * Every object in the catalogue used to be shown as a square of generated
 * artwork. That reads as a record sleeve, which is the wrong promise: these are
 * not tracks, they are tones, and a tone is a circle. So each one now gets a
 * disc with a ring in its own hue and one of these drawn inside it.
 *
 * They are deliberately thin and open — a filled pictogram at 20px on black
 * turns into a blob, and the whole point of the badge is that you can tell two
 * of them apart at a glance across a grid.
 *
 * All of them are drawn on a 24x24 box, stroke only, `currentColor`, so the
 * badge decides the colour and the size in one place.
 */
export type GlyphId =
  | 'moon'
  | 'planet'
  | 'wave'
  | 'sun'
  | 'flower'
  | 'spiral'
  | 'drop'
  | 'star'
  | 'heart'
  | 'bolt'
  | 'eye'
  | 'mountain'
  | 'disc'
  | 'prism'

const S = { stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const PATHS: Record<GlyphId, JSX.Element> = {
  moon: <path d="M16.2 3.6a8.6 8.6 0 10 4.2 10.9 6.9 6.9 0 01-4.2-10.9z" {...S} />,
  planet: (
    <>
      <circle cx="12" cy="12" r="5.2" {...S} />
      <ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-22 12 12)" {...S} />
    </>
  ),
  wave: (
    <path
      d="M2.5 12c1.6-4.6 3.2-4.6 4.8 0s3.2 4.6 4.8 0 3.2-4.6 4.8 0 3.2 4.6 4.6 0"
      {...S}
    />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" {...S} />
      <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" {...S} />
    </>
  ),
  flower: (
    <>
      <circle cx="12" cy="12" r="2.4" {...S} />
      {[0, 45, 90, 135].map((a) => (
        <ellipse key={a} cx="12" cy="12" rx="8.4" ry="3.2" transform={`rotate(${a} 12 12)`} {...S} />
      ))}
    </>
  ),
  spiral: (
    <path
      d="M12 12a2.6 2.6 0 112.6 2.6A5.2 5.2 0 019.4 9.4 7.8 7.8 0 0117.2 1.6"
      transform="translate(0 4.2)"
      {...S}
    />
  ),
  drop: <path d="M12 3.2c3.6 4.3 5.6 7.1 5.6 9.6a5.6 5.6 0 11-11.2 0c0-2.5 2-5.3 5.6-9.6z" {...S} />,
  star: <path d="M12 2.6l2.3 6.3a1.6 1.6 0 001 1l6.1 2.1-6.1 2.1a1.6 1.6 0 00-1 1L12 21.4l-2.3-6.3a1.6 1.6 0 00-1-1L2.6 12l6.1-2.1a1.6 1.6 0 001-1z" {...S} />,
  heart: <path d="M12 20.2S3.6 15 3.6 9.3A4.7 4.7 0 0112 6.6a4.7 4.7 0 018.4 2.7c0 5.7-8.4 10.9-8.4 10.9z" {...S} />,
  bolt: <path d="M13.4 2.6L5.2 13.4h5.4l-.4 8 8.2-10.8h-5.4z" {...S} />,
  eye: (
    <>
      <path d="M1.8 12s3.9-6.4 10.2-6.4S22.2 12 22.2 12s-3.9 6.4-10.2 6.4S1.8 12 1.8 12z" {...S} />
      <circle cx="12" cy="12" r="2.6" {...S} />
    </>
  ),
  mountain: (
    <>
      <path d="M2.4 19.2l6-9.6 4 5.6 3-4 6.2 8z" {...S} />
      <path d="M2.4 19.2h18.2" {...S} />
    </>
  ),
  disc: (
    <>
      <circle cx="12" cy="12" r="8.8" {...S} />
      <circle cx="12" cy="12" r="4.4" {...S} />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  prism: (
    <>
      <path d="M12 2.8L21 19.2H3z" {...S} />
      <path d="M12 2.8v16.4" {...S} />
    </>
  ),
}

export function Glyph({ id, size = 24 }: { id: GlyphId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {PATHS[id]}
    </svg>
  )
}

/**
 * Which mark belongs to a frequency.
 *
 * Named per entry rather than derived from the type, because the meaning is
 * what picks the mark: 528 is the one people come to for repair, so it gets the
 * rosette; 639 is about connection, so it gets the heart. A rule based on
 * `type` would have given all ten solfeggio tones the same drawing and thrown
 * away the only thing that tells them apart at a glance.
 */
const BY_ID: Record<string, GlyphId> = {
  'sol-174': 'mountain',
  'sol-285': 'drop',
  'sol-396': 'mountain',
  'sol-417': 'wave',
  'sol-432': 'prism',
  'sol-528': 'flower',
  'sol-639': 'heart',
  'sol-741': 'drop',
  'sol-852': 'eye',
  'sol-963': 'star',
  'tun-440': 'prism',
  'tun-444': 'prism',
  'tun-256': 'prism',
  'tun-128': 'prism',
  'bb-delta': 'moon',
  'bb-theta': 'spiral',
  'bb-schumann': 'mountain',
  'bb-alpha': 'wave',
  'bb-smr': 'wave',
  'bb-beta': 'bolt',
  'bb-gamma': 'bolt',
  'bb-gamma40': 'star',
}

export function glyphForFrequency(f: Frequency): GlyphId {
  // Every planetary tone is a planet; everything else is named above, and the
  // fallback keeps a new catalogue entry from rendering an empty circle.
  return BY_ID[f.id] ?? (f.type === 'cosmic' ? 'planet' : f.type === 'binaural' ? 'wave' : 'prism')
}

export const GLYPH_FOR_THEME: Record<JourneyTheme, GlyphId> = {
  start: 'star',
  rest: 'moon',
  work: 'bolt',
  motion: 'wave',
  inner: 'flower',
  intimacy: 'heart',
  club: 'disc',
  psychedelic: 'spiral',
}
