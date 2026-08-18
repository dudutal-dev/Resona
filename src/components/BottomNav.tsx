import { navigate, type Route } from '../lib/router'
import { useT, type StringKey } from '../lib/i18n'
import { useSession } from '../store/sessionStore'

const ITEMS: { route: Route['name']; href: string; label: StringKey; icon: JSX.Element }[] = [
  {
    route: 'home',
    href: '/',
    label: 'nav.home',
    icon: (
      <path
        d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    ),
  },
  {
    route: 'journeys',
    href: '/journeys',
    label: 'nav.journeys',
    icon: (
      <>
        <path d="M4 7h16M4 12h9M4 17h13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="18" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" />
      </>
    ),
  },
  {
    route: 'frequencies',
    href: '/frequencies',
    label: 'nav.frequencies',
    icon: (
      <path
        d="M3 12h2l2-7 3 14 3-17 3 13 2-3h3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    route: 'presets',
    href: '/presets',
    label: 'nav.presets',
    icon: (
      <>
        <path d="M6 4v16M12 4v16M18 4v16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="6" cy="9" r="2" fill="currentColor" />
        <circle cx="12" cy="15" r="2" fill="currentColor" />
        <circle cx="18" cy="8" r="2" fill="currentColor" />
      </>
    ),
  },
  {
    route: 'settings',
    href: '/settings',
    label: 'nav.settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10l1.4 1.4m0-12.8l-1.4 1.4m-10 10l-1.4 1.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </>
    ),
  },
]

export function BottomNav({ current }: { current: Route['name'] }) {
  const isPlaying = useSession((s) => s.isPlaying)
  const { t } = useT()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.6rem,env(safe-area-inset-bottom))]"
      aria-label={t('nav.aria')}
    >
      {/* Scrim: the bar floats over scrolling content, and without this the text
          underneath reads straight through it. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-28"
        style={{ background: 'linear-gradient(to top, var(--bg-deep) 30%, transparent)' }}
        aria-hidden
      />
      {/*
        Icons only, and the label is the tooltip rather than a caption.

        Five words under five icons is a third of the bar's height spent
        repeating what the pictograms already say, and it forces every label to
        be short enough to fit rather than clear. The current tab is marked by a
        filled shape behind its icon, which is louder than a caption and takes no
        vertical room.
      */}
      <div className="bar mx-auto flex max-w-sm items-center justify-between rounded-full p-1.5">
        {ITEMS.map((item) => {
          const active =
            current === item.route ||
            (item.route === 'journeys' && (current === 'journey' || current === 'journeyDay'))
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              aria-current={active ? 'page' : undefined}
              aria-label={t(item.label)}
              title={t(item.label)}
              className="relative grid h-12 flex-1 place-items-center rounded-full transition-all active:scale-90"
              style={{
                background: active ? 'var(--nav-active-bg)' : 'transparent',
                color: active ? 'var(--txt)' : 'var(--txt-3)',
              }}
            >
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden>
                {item.icon}
              </svg>
              {item.route === 'frequencies' && isPlaying && (
                <span
                  className="absolute end-2.5 top-2.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--glow)' }}
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
