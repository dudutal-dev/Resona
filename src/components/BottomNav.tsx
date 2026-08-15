import { navigate, type Route } from '../lib/router'
import { useSession } from '../store/sessionStore'

const ITEMS: { route: Route['name']; href: string; label: string; icon: JSX.Element }[] = [
  {
    route: 'home',
    href: '/',
    label: 'בית',
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
    label: 'מסעות',
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
    label: 'תדרים',
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
    label: 'פריסטים',
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
    label: 'הגדרות',
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

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 safe-bottom"
      style={{ paddingInline: '0.75rem' }}
      aria-label="ניווט ראשי"
    >
      {/* Scrim: the bar floats over scrolling content, and without this the text
          underneath reads straight through the frosted panel. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32"
        style={{ background: 'linear-gradient(to top, var(--bg-deep) 35%, transparent)' }}
        aria-hidden
      />
      <div className="glass-strong mx-auto flex max-w-md items-center justify-between rounded-3xl px-2 py-1.5">
        {ITEMS.map((item) => {
          const active =
            current === item.route ||
            (item.route === 'journeys' && (current === 'journey' || current === 'journeyDay'))
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition-all active:scale-95"
              style={{ color: active ? 'var(--accent)' : 'var(--txt-3)' }}
            >
              {active && (
                <span
                  className="absolute inset-x-2 -top-px h-px"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 12px var(--glow)' }}
                  aria-hidden
                />
              )}
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
                {item.icon}
              </svg>
              <span className="text-[10px] font-semibold leading-none">{item.label}</span>
              {item.route === 'frequencies' && isPlaying && (
                <span
                  className="absolute right-1/2 top-1 h-1.5 w-1.5 translate-x-3 rounded-full"
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
