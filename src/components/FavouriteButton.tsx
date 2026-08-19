import { useT } from '../lib/i18n'
import { useFavourites } from '../store/favouritesStore'

/**
 * The star on a journey.
 *
 * A heart rather than a star, to match the tab it fills. It stops the press
 * from reaching whatever it is sitting on — every one of these is inside a card
 * that navigates, and a favourite that also opened the journey would be
 * impossible to use.
 */
export function FavouriteButton({
  journeyId,
  size = 20,
  onCard = false,
}: {
  journeyId: string
  size?: number
  /** On a saturated journey card, where the palette is white rather than themed. */
  onCard?: boolean
}) {
  const { t } = useT()
  const ids = useFavourites((s) => s.ids)
  const toggle = useFavourites((s) => s.toggle)
  const on = ids.includes(journeyId)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        toggle(journeyId)
      }}
      aria-pressed={on}
      aria-label={t(on ? 'fav.remove' : 'fav.add')}
      title={t(on ? 'fav.remove' : 'fav.add')}
      className="grid shrink-0 place-items-center rounded-full transition-transform active:scale-90"
      style={{
        height: size * 1.7,
        width: size * 1.7,
        color: onCard ? '#fff' : on ? 'var(--gold)' : 'var(--txt-3)',
        opacity: onCard && !on ? 0.72 : 1,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={on ? 'currentColor' : 'none'}
        aria-hidden
      >
        <path
          d="M12 20.2S3.8 15.1 3.8 9.5A4.6 4.6 0 0112 6.9a4.6 4.6 0 018.2 2.6c0 5.6-8.2 10.7-8.2 10.7z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
