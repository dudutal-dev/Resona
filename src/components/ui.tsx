import { useEffect, type ReactNode } from 'react'
import { trustNoticeKey, trustShortKey } from '../lib/catalog'
import { useT } from '../lib/i18n'
import type { TrustLevel } from '../lib/types'
import { AppBar } from './AppBar'

/**
 * Page shell.
 *
 * Everything that is not the home screen or the journeys shelf goes through
 * here, which is why the top bar lives in `AppBar` rather than in this file: it
 * has to be identical on the screens that build their own body and on the ones
 * that do not.
 */
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
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 safe-top">
      <AppBar title={title} onBack={onBack} />
      {(subtitle || action) && (
        <div className="mb-6 flex items-start justify-between gap-3">
          {subtitle && <p className="txt-2 min-w-0 flex-1 text-[12.5px] leading-relaxed">{subtitle}</p>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
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
      className={`obj w-full rounded-3xl p-4 text-start transition-all duration-200 ${
        onClick ? 'active:scale-[0.99]' : ''
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
  const { t } = useT()
  const [h, s, l] = TRUST_TINT[trust]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold leading-none"
      style={{
        background: `hsl(${h} calc(${s}% * var(--trust-s, 1)) ${l}% / 0.14)`,
        // Each level has its own lightness, tuned against black. On paper they
        // all have to come down to pigment, so the light theme overrides them
        // with one value rather than three — see `--trust-l`.
        color: `hsl(${h} calc(${s}% * var(--trust-s, 1)) var(--trust-l, ${l}%))`,
      }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
        <path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {full ? t(trustNoticeKey(trust)) : t(trustShortKey(trust))}
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
        <span className="txt-3 readout text-xs">{display ?? `${Math.round(pct)}%`}</span>
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
  const { t } = useT()
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
        className="sheet-panel glass-strong animate-scale-in relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl p-5 sm:max-w-lg sm:rounded-3xl"
        style={{ boxShadow: 'var(--shadow-page)' }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label={t('common.close')} className="btn btn-ghost h-9 w-9 rounded-full p-0">
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
    <div className="obj px-6 py-14 text-center">
      <div
        className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full"
        style={{ background: 'var(--gold-soft)', border: '1px solid var(--gold)', color: 'var(--gold)' }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v18M5 8v8M19 8v8M8.5 5.5v13M15.5 5.5v13"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="text-[17px] font-extrabold">{title}</h3>
      <p className="txt-2 mx-auto mt-2 max-w-xs text-[13.5px] leading-relaxed">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
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
