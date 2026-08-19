import { useT } from '../lib/i18n'
import { back, navigate } from '../lib/router'

/**
 * The top bar, on every screen.
 *
 * Reading from the start of the line: where you are, then a lot of air, then
 * the wordmark, then the two things that are always available. The air is the
 * point — the old header put the title, a subtitle and an action button in one
 * crowded row, and the screen never announced itself. Here the title is the
 * largest thing on the page until you scroll past it.
 *
 * Only two controls live up here, and they are the same two everywhere:
 * settings and help. Anything screen-specific — filters, sorting — belongs in
 * the page under the bar, where it can be labelled.
 */
export function AppBar({ title, onBack = false }: { title: string; onBack?: boolean }) {
  const { t } = useT()
  return (
    <header className="flex items-center gap-2 pb-5 pt-3">
      {onBack && (
        <button onClick={back} aria-label={t('common.back')} className="circle-btn h-9 w-9">
          {/* Points the way back, which is against the reading direction. */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="flip-ltr">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      <h1 className="min-w-0 truncate text-[23px] font-extrabold leading-none tracking-tight">{title}</h1>
      <span className="wordmark ms-auto">RESONA</span>
      <button
        onClick={() => navigate('/settings')}
        aria-label={t('nav.settings')}
        className="circle-btn ms-1"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 7h16M7 12h10M10 17h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </button>
      <button onClick={() => navigate('/about')} aria-label={t('nav.about')} className="circle-btn">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9.2 9a2.9 2.9 0 015.6 1c0 2-2.8 2.4-2.8 4.2M12 17.6h.01"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>
  )
}

/**
 * A section heading: the metal star, the title, and optionally a link to the
 * whole shelf. Used everywhere a screen changes subject.
 */
export function SectionHead({
  title,
  blurb,
  onAll,
  allLabel,
  tight = false,
}: {
  title: string
  blurb?: string
  onAll?: () => void
  allLabel?: string
  /** For the first heading on a screen, where the bar has already left air. */
  tight?: boolean
}) {
  return (
    <div className={`mb-2.5 ${tight ? 'mt-0' : 'mt-7'}`}>
      <div className="flex items-baseline gap-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="mark self-center" aria-hidden>
          <path d="M12 2l1.9 6.4a2 2 0 001.7 1.7L22 12l-6.4 1.9a2 2 0 00-1.7 1.7L12 22l-1.9-6.4a2 2 0 00-1.7-1.7L2 12l6.4-1.9a2 2 0 001.7-1.7z" />
        </svg>
        <h2 className="text-[17px] font-extrabold tracking-tight">{title}</h2>
        {onAll && (
          <button onClick={onAll} className="txt-3 ms-auto shrink-0 text-[11.5px] font-bold">
            {allLabel}
          </button>
        )}
      </div>
      {blurb && <p className="txt-2 mt-1.5 text-[12px] leading-relaxed">{blurb}</p>}
    </div>
  )
}
