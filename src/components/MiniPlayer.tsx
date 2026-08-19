import { freqLabel, getFrequency, getJourney, journeyTitle } from '../lib/catalog'
import { GLYPH_FOR_THEME, glyphForFrequency } from '../lib/glyphs'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { themeOf } from '../lib/themes'
import { useSession } from '../store/sessionStore'
import { Badge } from './Badge'
import { formatClock } from './ui'

/**
 * The docked transport, on every screen except the player itself.
 *
 * Reading from the start of the line: the object that is sounding, what it is,
 * and then — at the far end, where the thumb already is — the one control. The
 * badge is the same disc the object has everywhere else in the app, which is
 * the whole reason it is worth generating them: you recognise what is playing
 * from the shape, before reading the name.
 */
export function MiniPlayer({ hidden }: { hidden: boolean }) {
  const { config, isPlaying, elapsed, remaining, toggle, activeJourney } = useSession()
  const { t, lang } = useT()
  if (hidden || !isPlaying) return null

  const root = getFrequency(config.rootId)
  const journey = activeJourney ? getJourney(activeJourney.journeyId) : null
  const title = journey ? journeyTitle(journey, lang) : root ? freqLabel(root, lang) : 'Resona'
  const hue = root?.hue ?? 265
  const glyph = journey ? GLYPH_FOR_THEME[themeOf(journey)] : root ? glyphForFrequency(root) : 'prism'

  return (
    <div className="fixed inset-x-0 bottom-[4.6rem] z-40 px-3">
      <div className="dock animate-fade-up mx-auto flex max-w-md items-center gap-2.5 p-2.5">
        <button
          onClick={() => navigate('/player')}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
          aria-label={t('mini.open')}
        >
          <Badge hue={hue} glyph={glyph} size={44} playing />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-extrabold leading-tight">
              {title}
              {root?.hz != null && (
                <>
                  {' — '}
                  {/* The dash stays outside the isolated run: inside it, a
                      bidirectional isolate drops it on the wrong side of the
                      number in Hebrew. */}
                  <span className="readout">{root.hz}Hz</span>
                </>
              )}
            </span>
            <span className="txt-3 mt-0.5 block truncate text-[11px] leading-tight">
              <span className="readout">{formatClock(elapsed)}</span>
              {remaining !== null && t('mini.remaining', { clock: formatClock(remaining) })}
            </span>
          </span>
        </button>
        {/* The only round gradient in the chrome. It means sound, here as
            everywhere else. */}
        <button
          onClick={() => void toggle()}
          aria-label={t('common.stop')}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform active:scale-90"
          style={{
            background: 'linear-gradient(135deg, var(--cta-from), var(--cta-to))',
            color: 'var(--cta-fg)',
            boxShadow: '0 10px 26px -10px var(--cta-glow)',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4.2" height="14" rx="1.4" />
            <rect x="13.8" y="5" width="4.2" height="14" rx="1.4" />
          </svg>
        </button>
      </div>
    </div>
  )
}
