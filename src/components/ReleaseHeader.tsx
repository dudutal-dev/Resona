import type { ReactNode } from 'react'
import { useT } from '../lib/i18n'
import { back } from '../lib/router'

export type ReleaseAction = {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
  /** Drawn in the accent colour, the way a streaming app marks a saved item. */
  on?: boolean
}

/**
 * The top of a page that is about one thing: a frequency, or a journey.
 *
 * This is the shape a streaming app gives a release, and it is borrowed
 * deliberately. The old player opened on a control panel — an orb, a transport
 * and a stack of settings — which told you how to operate a session before it
 * told you which one you were about to hear. A cover, a name, and two buttons
 * says the second thing first, and the operating parts move below the fold
 * where they belong.
 *
 * The cover is repeated behind the page, blown up and blurred out. That costs
 * one extra decode of an image already in memory and is the single cheapest way
 * to make a black screen feel like it belongs to what is on it.
 */
export function ReleaseHeader({
  cover,
  art,
  eyebrow,
  title,
  subtitle,
  onSubtitle,
  meta,
  primary,
  secondary,
  actions,
  menu,
}: {
  cover: string
  /**
   * Drawn in the square instead of the cover, when there is something live to
   * put there. The cover still paints the backdrop, so the page keeps its
   * colour — see the note in `PlayerScreen`.
   */
  art?: ReactNode
  eyebrow?: string
  title: string
  subtitle: string
  onSubtitle?: () => void
  meta?: ReactNode
  primary: { label: string; icon: ReactNode; onClick: () => void }
  secondary?: { label: string; icon: ReactNode; onClick: () => void }
  actions?: ReleaseAction[]
  menu?: ReactNode
}) {
  const { t } = useT()

  return (
    <header className="relative">
      {/* Bleed. Sits behind the whole header and dissolves into the page. */}
      <div
        className="pointer-events-none absolute inset-x-[-1rem] top-[-3rem] -z-10 h-[30rem] overflow-hidden"
        aria-hidden
      >
        <img src={cover} alt="" className="h-full w-full scale-[1.35] object-cover opacity-70 blur-[52px]" />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 8%, var(--bg-deep) 88%)' }}
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={back} aria-label={t('common.back')} className="orb-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="flip-ltr">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {menu}
      </div>

      <div className="mx-auto mt-3 aspect-square w-[62%] max-w-[268px]">
        {art ?? (
          <img
            src={cover}
            alt=""
            className="block h-full w-full rounded-[12px] object-cover"
            style={{ boxShadow: '0 24px 50px -18px rgba(0,0,0,0.75)' }}
          />
        )}
      </div>

      {eyebrow && (
        <p
          className="txt-3 mt-6 text-center text-[11px] font-semibold uppercase"
          style={{ letterSpacing: '0.16em' }}
        >
          {eyebrow}
        </p>
      )}
      <h1 className="mt-4 truncate text-center text-[27px] font-extrabold leading-tight tracking-tight">
        {title}
      </h1>

      {onSubtitle ? (
        <button
          onClick={onSubtitle}
          className="txt-2 mx-auto mt-1 flex max-w-full items-center gap-1 text-[15px] font-bold"
        >
          <span className="truncate">{subtitle}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden className="flip-ltr shrink-0">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <p className="txt-2 mt-1 text-center text-[15px] font-bold">{subtitle}</p>
      )}

            {/* One line, the way a release states its year and its format — not a row
          of boxes. Anything that needs a box gets exactly one. */}
      {meta && (
        <div className="txt-3 mt-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-[13px] font-semibold">
          {meta}
        </div>
      )}

      <div className="mt-6 flex items-stretch gap-3">
        <button onClick={primary.onClick} className="pill pill-solid">
          {primary.icon}
          {primary.label}
        </button>
        {secondary && (
          <button onClick={secondary.onClick} className="pill pill-quiet">
            {secondary.icon}
            {secondary.label}
          </button>
        )}
      </div>

      {actions && actions.length > 0 && (
        <div className="mt-5 flex items-start justify-around gap-1">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={a.onClick}
              data-on={a.on ? 'true' : 'false'}
              className="act"
              style={{ color: a.on ? 'var(--accent)' : 'var(--txt-2)' }}
            >
              <span className="act-glyph" aria-hidden>
                {a.icon}
              </span>
              <span className="w-full truncate text-center text-[11px] font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
