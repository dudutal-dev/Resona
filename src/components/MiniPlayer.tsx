import { freqLabel, getFrequency } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { hueFill, hueLine, hueText } from '../lib/themes'
import { useSession } from '../store/sessionStore'
import { formatClock } from './ui'

/** Persistent transport shown on every screen except the player itself. */
export function MiniPlayer({ hidden }: { hidden: boolean }) {
  const { config, isPlaying, elapsed, remaining, toggle } = useSession()
  const { t, lang } = useT()
  if (hidden || !isPlaying) return null

  const root = getFrequency(config.rootId)

  return (
    <div className="fixed inset-x-0 bottom-[4.75rem] z-40 px-3 safe-bottom">
      <div className="glass-strong animate-fade-up mx-auto flex max-w-md items-center gap-3 rounded-2xl p-2 pe-3">
        <button onClick={() => navigate('/player')} className="flex min-w-0 flex-1 items-center gap-3 text-start">
          <span
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold"
            style={{
              background: hueFill(root?.hue ?? 265),
              border: `1px solid ${hueLine(root?.hue ?? 265)}`,
              color: hueText(root?.hue ?? 265),
            }}
          >
            <span className="absolute inset-0 animate-pulse-ring rounded-xl" style={{ border: '1.5px solid hsl(var(--h) 95% 70% / 0.45)' }} aria-hidden />
            <span className="readout">{root?.hz}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{root ? freqLabel(root, lang) : ''}</span>
            <span className="txt-3 readout block text-[10px]">
              {formatClock(elapsed)}
              {remaining !== null && t('mini.remaining', { clock: formatClock(remaining) })}
            </span>
          </span>
        </button>
        <button
          onClick={() => void toggle()}
          aria-label={t('common.stop')}
          className="btn h-10 w-10 shrink-0 rounded-full p-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1.5" />
            <rect x="14" y="5" width="4" height="14" rx="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
