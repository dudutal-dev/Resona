import figurePortrait from '../assets/turntables/figure-portrait.mp4?url'
import figurePoster from '../assets/turntables/figure-portrait-poster.webp'
import figureWide from '../assets/turntables/figure-wide.mp4?url'
import figureWidePoster from '../assets/turntables/figure-wide-poster.webp'
import type { StringKey } from '../lib/i18n'

/**
 * The figures the television stage can show.
 *
 * Artwork, plus one scene — which is the only reason this is a union rather
 * than a list of image sources. Artwork is shipped as WebP and drawn whole: an
 * earlier version reduced it to a point cloud and redrew that, which let every
 * point be moved individually and threw away the detail that made the renders
 * worth using. The movement they need turns out to be the kind a whole image
 * can be given — see `FigureField`.
 *
 * The scene is `ChakraScene`, in Three.js. It is split out and imported only
 * when it is chosen, so it is not part of the page that loads first — but it is
 * 250KB gzipped, more than the rest of the app put together, and the service
 * worker precaches it like everything else. That is deliberate: an offline app
 * whose only other figure needs the network would be worse than one that costs
 * more to install.
 *
 * **There is no still artwork here at the moment.** The eleven renders that
 * used to ship were pulled out of the bundle to make room for better ones; they
 * are not lost — every original is still in `assets/figures`, and the round trip
 * back in is three steps:
 *
 *   1. drop the PNGs in `assets/figures`
 *   2. `npm run pack-figures` — encodes them into `src/assets/figures`
 *   3. import each one below and add a line, with its name in both languages
 *
 * The `figure.*` keys for the old set are deliberately still in the dictionary,
 * so re-adding one is a single line rather than a translation pass.
 */
export type Figure =
  | { id: string; kind: 'image'; src: string; name: StringKey }
  | { id: string; kind: 'scene'; name: StringKey }
  /**
   * A figure making one revolution, played as a loop at a rate derived from the
   * session — see `TurntableField`.
   *
   * Two cuts of the same performance, because the stage is two different shapes
   * and neither crop of the other one is acceptable: a wide frame cropped to a
   * phone loses the figure's hands, and a tall frame letterboxed onto a
   * television is two black thirds. Which one plays is decided by the shape of
   * the screen at the moment, not by a setting — see `TvStage`.
   *
   * H.264 with no audio track, and only that: the note at the top of
   * `pack-turntables.mjs` has the reasoning for both.
   *
   * The posters are stills from each cut. They are what the picker shows and
   * what the stage paints while the video is still arriving — a video element
   * is not a thumbnail, and on iOS it paints nothing at all until it has
   * played. One per cut, because the stage that is waiting for the wide clip
   * should not be holding a tall still letterboxed into it.
   */
  | {
      id: string
      kind: 'turntable'
      portrait: string
      wide: string
      poster: string
      posterWide: string
      name: StringKey
    }

// The scene stays last, so the artwork reads as one run and the odd one out is
// at the end. Inserting into the middle shifts what a saved index points at,
// which is a tap to correct and not worth reordering the list to avoid.
export const FIGURES: Figure[] = [
  {
    id: 'chakra-turn',
    kind: 'turntable',
    portrait: figurePortrait,
    wide: figureWide,
    poster: figurePoster,
    posterWide: figureWidePoster,
    name: 'figure.chakraTurn',
  },
  { id: 'orbit', kind: 'scene', name: 'figure.scene' },
]

export const figureAt = (index: number): Figure =>
  FIGURES[((index % FIGURES.length) + FIGURES.length) % FIGURES.length]
