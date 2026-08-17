import starlight from '../assets/figures/1-starlight.webp'
import violet from '../assets/figures/2-violet.webp'
import spectrum from '../assets/figures/3-spectrum.webp'
import chakras from '../assets/figures/4-chakras.webp'
import type { StringKey } from '../lib/i18n'

/**
 * The figures the television stage can show.
 *
 * They are shipped as WebP and drawn whole. An earlier version reduced the
 * artwork to a point cloud and drew that instead, which let every point be moved
 * individually — but a body of light rendered at this quality is worth more
 * intact than it is reconstructed, and the movement it needs turns out to be the
 * kind a whole image can be given: it breathes, it lights along its height with
 * the harmony, and the sound bends it. See `FigureField`.
 *
 * `assets/figures` holds the originals and `scripts/pack-figures.mjs` does the
 * encoding; adding one means dropping a PNG there, running that, and adding a
 * line here with its name in both languages.
 */
export type Figure = {
  id: string
  src: string
  name: StringKey
}

export const FIGURES: Figure[] = [
  { id: 'chakras', src: chakras, name: 'figure.chakras' },
  { id: 'spectrum', src: spectrum, name: 'figure.spectrum' },
  { id: 'violet', src: violet, name: 'figure.violet' },
  { id: 'starlight', src: starlight, name: 'figure.starlight' },
]

export const figureAt = (index: number): Figure =>
  FIGURES[((index % FIGURES.length) + FIGURES.length) % FIGURES.length]
