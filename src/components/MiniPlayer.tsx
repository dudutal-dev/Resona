import { freqLabel, getFrequency, getJourney, journeyTitle } from '../lib/catalog'
import { coverForRoot } from '../lib/cover'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { formatClock } from './ui'

/**
 * Persistent transport, shown on every screen except the player itself.
 *
 * Modelled on the card a streaming app leaves docked above its navigation: a
 * cover, two lines, and the one control worth having without opening anything.
 * It floats rather than sitting in a fixed strip, which is what lets the
 * navigation keep its own rounded shape underneath.
 */
export function MiniPlayer({ hidden }: { hidden: boolean }) {
  const { config, isPlaying, elapsed, remaining, toggle, activeJourney } = useSession()
  const { t, lang } = useT()
  if (hidden || !isPlaying) return null

  const root = getFrequency(config.rootId)
  const journey = activeJourney ? getJourney(activeJourney.journeyId) : null
  const title = journey ? journeyTitle(journey, lang) : root ? freqLabel(root, lang) : 'Resona'
  const cover = coverForRoot(config.rootId)

  return (
    <div className="fixed inset-x-0 bottom-[5.25rem] z-40 px-4">
      <div className="bar animate-fade-up mx-auto max-w-sm rounded-[22px] p-2 pt-1.5">
        {/* The grab handle is not a control — it is the affordance that says this
            card belongs to a sheet that can be pulled open. */}
        <div className="mx-auto mb-1.5 h-1 w-9 rounded-full" style={{ background: 'var(--txt-3)', opacity: 0.5 }} aria-hidden />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/player')}
            className="flex min-w-0 flex-1 items-center gap-3 text-start"
            aria-label={t('mini.open')}
          >
            <img
              src={cover}
              alt=""
              className="h-11 w-11 shrink-0 rounded-[7px] object-cover"
              style={{ boxShadow: '0 4px 12px -4px rgba(0,0,0,0.6)' }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold leading-tight">{title}</span>
              <span className="txt-3 block truncate text-[12px] leading-tight">
                <span className="readout">{root?.hz} Hz</span>
                {' · '}
                <span className="readout">{formatClock(elapsed)}</span>
                {remaining !== null && t('mini.remaining', { clock: formatClock(remaining) })}
              </span>
            </span>
          </button>
          <button
            onClick={() => void toggle()}
            aria-label={t('common.stop')}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform active:scale-90"
            style={{ color: 'var(--txt)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4.2" height="14" rx="1" />
              <rect x="13.8" y="5" width="4.2" height="14" rx="1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
