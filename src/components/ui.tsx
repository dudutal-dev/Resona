import { useEffect, type ReactNode } from 'react'
import { TRUST_NOTICE, TRUST_SHORT } from '../lib/catalog'
import type { TrustLevel } from '../lib/types'
import { back } from '../lib/router'

/** Page shell: sticky glass header with a back affordance, then content. */
export function Screen({
  title,
  subtitle,
  onBack,
  action,
  children,
}: {
  title: string
  subtitle?: string
  onBack?: boolean
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-28 safe-top">
      <header className="mb-6 flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={back}
                aria-label="חזרה"
                className="btn btn-ghost -mr-2 h-9 w-9 rounded-full p-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          </div>
          {subtitle && <p className="txt-2 mt-1 text-sm">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </div>
  )
}

export function Card({
  children,
  className = '',
  onClick,
  glow = false,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  glow?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`glass ${glow ? 'rim' : ''} w-full rounded-3xl p-4 text-right transition-all duration-200 ${
        onClick ? 'hover:-translate-y-0.5 active:scale-[0.99]' : ''
      } ${className}`}
      style={glow ? { boxShadow: '0 18px 50px -22px var(--glow)' } : undefined}
    >
      {children}
    </Tag>
  )
}

/** [hue, saturation, lightness] per trust level — amber, cyan, slate. */
const TRUST_TINT: Record<TrustLevel, [number, number, number]> = {
  traditional: [43, 100, 71],
  research_backed_partial: [188, 100, 74],
  reference: [220, 12, 72],
}

/**
 * The transparency badge required by §5.1. It never appears without the full
 * sentence being one tap away — the short label alone would be misleading.
 */
export function TrustBadge({ trust, full = false }: { trust: TrustLevel; full?: boolean }) {
  const [h, s, l] = TRUST_TINT[trust]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium leading-tight"
      style={{
        background: `hsl(${h} ${s}% ${l}% / 0.12)`,
        color: `hsl(${h} ${s}% ${l}%)`,
        border: `1px solid hsl(${h} ${s}% ${l}% / 0.3)`,
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {full ? TRUST_NOTICE[trust] : TRUST_SHORT[trust]}
    </span>
  )
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  display,
  icon,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  display?: string
  icon?: ReactNode
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-medium">
          {icon}
          {label}
        </span>
        <span className="txt-3 ltr text-xs tabular-nums">{display ?? `${Math.round(pct)}%`}</span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ['--fill' as string]: `${pct}%` }}
      />
    </div>
  )
}

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="glass-strong animate-scale-in relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-lg sm:rounded-3xl"
        style={{ boxShadow: 'var(--shadow-page)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="סגירה" className="btn btn-ghost h-9 w-9 rounded-full p-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="glass rounded-3xl px-6 py-12 text-center">
      <div
        className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl"
        style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-line)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: 'var(--accent)' }}>
          <path
            d="M12 3v18M5 8v8M19 8v8M8.5 5.5v13M15.5 5.5v13"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="txt-2 mx-auto mt-1 max-w-xs text-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
