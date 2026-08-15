import { useMemo } from 'react'
import { useSettings } from '../store/settingsStore'

/**
 * The ambient backdrop: three slow-drifting aurora blobs tinted by the current
 * accent hue, a static starfield, and a fine film grain that keeps the large
 * gradients from banding on wide-gamut displays.
 *
 * Everything is CSS-animated — no rAF loop — so it costs almost nothing over a
 * multi-hour session.
 */
export function AuroraBackground({ intensity = 1 }: { intensity?: number }) {
  const reducedMotion = useSettings((s) => s.reducedMotion)

  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() < 0.85 ? 1 : 2,
        delay: Math.random() * 6,
        duration: 4 + Math.random() * 6,
        opacity: 0.25 + Math.random() * 0.5,
      })),
    [],
  )

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 50% -10%, hsl(var(--h) 70% 22% / 0.55), transparent 60%), radial-gradient(100% 60% at 50% 110%, hsl(calc(var(--h) + 45) 70% 20% / 0.4), transparent 65%)',
        }}
      />

      {/* Drifting aurora blobs */}
      <div
        className={`absolute -top-1/4 right-[-15%] h-[70vmax] w-[70vmax] rounded-full blur-[120px] ${
          reducedMotion ? '' : 'animate-aurora-drift'
        }`}
        style={{
          background: `radial-gradient(circle, hsl(var(--h) 95% 60% / ${0.3 * intensity}), transparent 65%)`,
        }}
      />
      <div
        className={`absolute bottom-[-25%] left-[-20%] h-[65vmax] w-[65vmax] rounded-full blur-[130px] ${
          reducedMotion ? '' : 'animate-aurora-drift'
        }`}
        style={{
          animationDelay: '-9s',
          background: `radial-gradient(circle, hsl(calc(var(--h) + 55) 95% 58% / ${0.26 * intensity}), transparent 65%)`,
        }}
      />
      <div
        className={`absolute left-[25%] top-[30%] h-[45vmax] w-[45vmax] rounded-full blur-[110px] ${
          reducedMotion ? '' : 'animate-aurora-drift'
        }`}
        style={{
          animationDelay: '-17s',
          background: `radial-gradient(circle, hsl(calc(var(--h) - 40) 95% 62% / ${0.2 * intensity}), transparent 60%)`,
        }}
      />

      {/* Starfield */}
      <div className="absolute inset-0 dark-only">
        {stars.map((s) => (
          <span
            key={s.id}
            className={reducedMotion ? '' : 'animate-twinkle'}
            style={{
              position: 'absolute',
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.size,
              height: s.size,
              borderRadius: 99,
              background: '#fff',
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Vignette — lighter in the light theme, where a dark edge reads as grime */}
      <div className="vignette absolute inset-0" />
    </div>
  )
}
