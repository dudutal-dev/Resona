import seraphMp4 from '../assets/turntables/1-seraph.mp4?url'
import seraphWebm from '../assets/turntables/1-seraph.webm?url'
import cosmosMp4 from '../assets/turntables/2-cosmos.mp4?url'
import cosmosWebm from '../assets/turntables/2-cosmos.webm?url'
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
 * **There is no artwork here at the moment.** The eleven renders that used to
 * ship were pulled out of the bundle to make room for better ones; they are not
 * lost — every original is still in `assets/figures`, and the round trip back
 * in is three steps:
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
   * session — see `TurntableField`. WebM first because every browser that can
   * take it prefers it; H.264 second because it is what iOS decodes in
   * hardware. Only the chosen one is downloaded.
   */
  | { id: string; kind: 'turntable'; sources: { src: string; type: string }[]; name: StringKey }

// The scene stays last, so the artwork reads as one run and the odd one out is
// at the end. Inserting into the middle shifts what a saved index points at,
// which is a tap to correct and not worth reordering the list to avoid.
export const FIGURES: Figure[] = [
  {
    id: 'cosmos-turn',
    kind: 'turntable',
    sources: [
      { src: cosmosWebm, type: 'video/webm' },
      { src: cosmosMp4, type: 'video/mp4' },
    ],
    name: 'figure.cosmosTurn',
  },
  {
    id: 'seraph-turn',
    kind: 'turntable',
    sources: [
      { src: seraphWebm, type: 'video/webm' },
      { src: seraphMp4, type: 'video/mp4' },
    ],
    name: 'figure.seraphTurn',
  },
  { id: 'orbit', kind: 'scene', name: 'figure.scene' },
]

export const figureAt = (index: number): Figure =>
  FIGURES[((index % FIGURES.length) + FIGURES.length) % FIGURES.length]
