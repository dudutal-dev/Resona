import { Glyph, type GlyphId } from '../lib/glyphs'
import { hueFill, hueGlow, hueLine, hueText } from '../lib/themes'

/**
 * A catalogue object, drawn as a disc.
 *
 * Ring in the object's own hue, two fainter rings inside it, a dark centre and
 * a line-drawn mark. The concentric rings are not decoration for its own sake:
 * they are what makes a small circle read as a *tone* rather than as an avatar,
 * and they are the only thing that survives at 44px where the mark alone would
 * be a smudge.
 *
 * The colours all run through the `hue*` helpers rather than being written as
 * literal `hsl()`, which is what lets noir take every badge down to about half
 * saturation without this file knowing anything about themes.
 */
export function Badge({
  hue,
  glyph,
  size = 56,
  playing = false,
}: {
  hue: number
  glyph: GlyphId
  size?: number
  /** Lights the ring, for the object currently sounding. */
  playing?: boolean
}) {
  const ring = size * 0.075
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full"
      style={{
        height: size,
        width: size,
        background: `radial-gradient(70% 70% at 50% 30%, ${hueFill(hue, 0.22)}, var(--disc) 78%)`,
        border: `1px solid ${hueLine(hue, playing ? 0.85 : 0.5)}`,
        boxShadow: `0 0 ${size * 0.36}px ${hueGlow(hue, playing ? 0.55 : 0.28)}`,
      }}
      aria-hidden
    >
      <span
        className="pointer-events-none absolute rounded-full"
        style={{ inset: ring, border: `1px solid ${hueLine(hue, 0.2)}` }}
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{ inset: ring * 2.4, border: `1px solid ${hueLine(hue, 0.12)}` }}
      />
      <span style={{ color: hueText(hue) }}>
        <Glyph id={glyph} size={size * 0.42} />
      </span>
    </span>
  )
}
