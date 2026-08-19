import type { GlyphId } from '../lib/glyphs'
import { Badge } from './Badge'

/**
 * One catalogue object in a two-column grid.
 *
 * The words lead and the disc closes the row, which is the opposite of the
 * shelf card this replaced. A shelf puts the artwork first because you are
 * scanning pictures; a grid like this is read, and a 44px disc in front of the
 * name pushes every title into two lines for no gain. Here the disc is the
 * full stop.
 */
export function Tile({
  hue,
  glyph,
  title,
  meta,
  playing = false,
  onClick,
}: {
  hue: number
  glyph: GlyphId
  title: string
  meta?: string
  playing?: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="obj flex items-center gap-2.5 p-3 text-start">
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[15px] font-extrabold leading-tight">{title}</span>
        {meta && <span className="txt-3 readout mt-1 block truncate text-[12px]">{meta}</span>}
      </span>
      <Badge hue={hue} glyph={glyph} size={46} playing={playing} />
    </button>
  )
}
