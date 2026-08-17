import starlight from '../assets/figures/1-starlight.webp'
import violet from '../assets/figures/2-violet.webp'
import spectrum from '../assets/figures/3-spectrum.webp'
import chakras from '../assets/figures/4-chakras.webp'
import type { StringKey } from '../lib/i18n'

/**
 * The figures the television stage can show.
 *
 * Four are artwork and one is a scene, which is the only reason this is a union
 * rather than a list of image sources. The artwork is shipped as WebP and drawn
 * whole: an earlier version reduced it to a point cloud and redrew that, which
 * let every point be moved individually and threw away the detail that made the
 * renders worth using. The movement they need turns out to be the kind a whole
 * image can be given — see `FigureField`.
 *
 * The scene is `ChakraScene`, in Three.js. It is split out and imported only when
 * it is chosen, so it is not part of the page that loads first — but it is 250KB
 * gzipped, more than the rest of the app put together, and the service worker
 * precaches it like everything else. That is deliberate: an offline app whose
 * fifth figure only works online would be worse than one that costs more to
 * install. It does mean the saving is on first paint, not on the download.
 *
 * `assets/figures` holds the originals and `scripts/pack-figures.mjs` does the
 * encoding; adding one means dropping a PNG there, running that, and adding a
 * line here with its name in both languages.
 */
export type Figure =
  | { id: string; kind: 'image'; src: string; name: StringKey }
  | { id: string; kind: 'scene'; name: StringKey }

export const FIGURES: Figure[] = [
  { id: 'chakras', kind: 'image', src: chakras, name: 'figure.chakras' },
  { id: 'spectrum', kind: 'image', src: spectrum, name: 'figure.spectrum' },
  { id: 'violet', kind: 'image', src: violet, name: 'figure.violet' },
  { id: 'starlight', kind: 'image', src: starlight, name: 'figure.starlight' },
  { id: 'orbit', kind: 'scene', name: 'figure.scene' },
]

export const figureAt = (index: number): Figure =>
  FIGURES[((index % FIGURES.length) + FIGURES.length) % FIGURES.length]
