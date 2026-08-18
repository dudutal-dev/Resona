import type { ReactNode } from 'react'

/**
 * A horizontal row of covers under a heading, with a link out to the full list.
 *
 * This is the unit a streaming home screen is built from, and it earns its place
 * here for the same reason it does there: the catalogue is far too big for one
 * vertical list, and a shelf shows eight things in the space a list spends on
 * two. Everything stays one gesture away — a swipe along the row, or a tap on
 * the heading to see all of it.
 */
export function Shelf({
  title,
  onAll,
  allLabel,
  children,
}: {
  title: string
  onAll?: () => void
  allLabel?: string
  children: ReactNode
}) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex items-baseline justify-between gap-3 px-0.5">
        <h2 className="truncate text-[19px] font-extrabold tracking-tight">{title}</h2>
        {onAll && (
          <button onClick={onAll} className="txt-3 shrink-0 text-[12px] font-semibold">
            {allLabel}
          </button>
        )}
      </div>
      {/* Bleeds to both screen edges so the row reads as continuing past them
          rather than as a box that happens to scroll. */}
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">{children}</div>
    </section>
  )
}

/** One item on a shelf: a square cover, a name, and one line under it. */
export function ShelfCard({
  cover,
  title,
  subtitle,
  onClick,
  badge,
}: {
  cover: string
  title: string
  subtitle?: string
  onClick: () => void
  badge?: ReactNode
}) {
  return (
    <button onClick={onClick} className="w-[7.1rem] shrink-0 text-start transition-transform active:scale-95">
      <span className="relative block">
        <img
          src={cover}
          alt=""
          className="aspect-square w-full rounded-[10px] object-cover"
          style={{ boxShadow: '0 10px 24px -12px rgba(0,0,0,0.7)' }}
        />
        {badge && <span className="absolute bottom-1.5 end-1.5">{badge}</span>}
      </span>
      <span className="mt-2 block truncate text-[12px] font-bold leading-tight">{title}</span>
      {subtitle && <span className="txt-3 mt-0.5 block truncate text-[10px]">{subtitle}</span>}
    </button>
  )
}
