import { navigate, type Route } from '../lib/router'
import { useT, type StringKey } from '../lib/i18n'
import { useSession } from '../store/sessionStore'

/**
 * Five destinations, on the ground.
 *
 * The previous bar was a floating rounded pill with icons and no words, on the
 * argument that five captions are a third of the bar spent repeating the
 * pictograms. That argument is right about a bar of five *similar* things and
 * wrong here: "journeys" and "library" are not guessable from a shape, and the
 * first thing anyone did was tap the wrong one. So the labels are back, and the
 * bar sits flat against the bottom edge like a piece of the device rather than
 * a card floating over the page.
 *
 * The current tab is marked in the metal — no pill behind it. On black, colour
 * alone is a stronger signal than a filled shape, and it costs no height.
 */
const ITEMS: { route: Route['name']; href: string; label: StringKey; icon: JSX.Element }[] = [
  {
    route: 'home',
    href: '/',
    label: 'nav.home',
    icon: <path d="M4 10.6l8-6.2 8 6.2V19a1.4 1.4 0 01-1.4 1.4H5.4A1.4 1.4 0 014 19z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />,
  },
  {
    route: 'journeys',
    href: '/journeys',
    label: 'nav.journeys',
    icon: (
      <path
        d="M12 2.6l1.85 6.2a1.9 1.9 0 001.35 1.35L21.4 12l-6.2 1.85a1.9 1.9 0 00-1.35 1.35L12 21.4l-1.85-6.2a1.9 1.9 0 00-1.35-1.35L2.6 12l6.2-1.85a1.9 1.9 0 001.35-1.35z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    ),
  },
  {
    route: 'search',
    href: '/search',
    label: 'nav.search',
    icon: (
      <>
        <circle cx="11" cy="11" r="6.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M16 16l4.2 4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </>
    ),
  },
  {
    route: 'frequencies',
    href: '/frequencies',
    label: 'nav.library',
    icon: (
      <>
        <path d="M9.4 17.6V5.2l9-1.8v12.4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="7" cy="17.8" r="2.6" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16" cy="15.8" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      </>
    ),
  },
  {
    route: 'presets',
    href: '/presets',
    label: 'nav.favourites',
    icon: (
      <path
        d="M12 20.2S3.8 15.1 3.8 9.5A4.6 4.6 0 0112 6.9a4.6 4.6 0 018.2 2.6c0 5.6-8.2 10.7-8.2 10.7z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    ),
  },
]

export function BottomNav({ current }: { current: Route['name'] }) {
  const isPlaying = useSession((s) => s.isPlaying)
  const { t } = useT()

  return (
    <nav
      className="navbar fixed inset-x-0 bottom-0 z-40 pb-[max(0.35rem,env(safe-area-inset-bottom))]"
      aria-label={t('nav.aria')}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-3">
        {ITEMS.map((item) => {
          const active =
            current === item.route ||
            (item.route === 'journeys' && (current === 'journey' || current === 'journeyDay' || current === 'build'))
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              aria-current={active ? 'page' : undefined}
              className="navitem relative flex-1 transition-transform active:scale-90"
              data-on={active}
            >
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
                {item.icon}
              </svg>
              <span className="navlab">{t(item.label)}</span>
              {item.route === 'frequencies' && isPlaying && (
                <span
                  className="absolute end-[22%] top-1.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--gold)' }}
                  aria-hidden
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
