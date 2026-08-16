import {
  BEAT_FREQUENCIES,
  ROOT_FREQUENCIES,
  ROOT_GROUPS,
  TRUST_NOTICE,
  TRUST_SHORT,
} from '../lib/catalog'
import type { Frequency, TrustLevel } from '../lib/types'
import { TrustBadge } from './ui'

/**
 * The transparency sentences a set of entries actually needs.
 *
 * A single sentence per section only stayed true while every entry in it shared
 * a level. It no longer does — the standard A=440 tuning makes no claim, and
 * the Schumann band is tradition rather than partial evidence — so a blanket
 * footer would now misdescribe some of the rows above it.
 */
function Notices({ of }: { of: Frequency[] }) {
  const levels = [...new Set(of.map((f) => f.trust))] as TrustLevel[]
  return (
    <div className="mt-3 space-y-1">
      {levels.map((level) => (
        <p key={level} className="txt-3 text-[11px] leading-relaxed">
          {levels.length > 1 && <span className="font-semibold">{`${TRUST_SHORT[level]}: `}</span>}
          {TRUST_NOTICE[level]}
        </p>
      ))}
    </div>
  )
}

function FrequencyRow({
  freq,
  selected,
  onSelect,
  onInfo,
}: {
  freq: Frequency
  selected: boolean
  onSelect: () => void
  onInfo?: () => void
}) {
  const value = freq.hz ? `${freq.hz}` : `${freq.range?.[0]}–${freq.range?.[1]}`
  return (
    <div
      className={`glass relative flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 ${
        selected ? 'rim' : ''
      }`}
      style={{
        boxShadow: selected ? '0 14px 40px -20px var(--glow)' : undefined,
        background: selected ? 'var(--accent-soft)' : undefined,
      }}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-right">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-[13px] font-bold leading-none"
          style={{
            background: `hsl(${freq.hue} 85% 62% / 0.16)`,
            border: `1px solid hsl(${freq.hue} 85% 65% / 0.4)`,
            color: `hsl(${freq.hue} 90% 72%)`,
            boxShadow: selected ? `0 0 22px hsl(${freq.hue} 90% 60% / 0.45)` : undefined,
          }}
        >
          <span className="ltr">{value}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{freq.label}</span>
          <span className="txt-3 ltr mt-0.5 block text-[11px]">
            {freq.hz ? `${freq.hz} Hz` : `${freq.range?.[0]}–${freq.range?.[1]} Hz`}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1.5">
        <TrustBadge trust={freq.trust} />
        {onInfo && (
          <button
            onClick={onInfo}
            aria-label={`מידע על ${freq.label}`}
            className="btn btn-ghost h-8 w-8 rounded-full p-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 8h.01M11 11h1v5h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export function FrequencyPicker({
  selectedRoot,
  selectedBeat,
  onSelectRoot,
  onSelectBeat,
  onInfo,
  showBeats = true,
}: {
  selectedRoot: string
  selectedBeat: string | null
  onSelectRoot: (id: string) => void
  onSelectBeat: (id: string | null) => void
  onInfo?: (freq: Frequency) => void
  showBeats?: boolean
}) {
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-bold">תדר יסוד</h3>
          <span className="txt-3 text-[11px]">כל תו במלודיה נגזר ממנו</span>
        </div>

        <div className="space-y-5">
          {ROOT_GROUPS.map((group) => (
            <div key={group.id}>
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h4 className="text-[12px] font-bold txt-2">{group.title}</h4>
                <span className="txt-3 truncate text-[10px]">{group.note}</span>
              </div>
              <div className="space-y-2">
                {group.items.map((f) => (
                  <FrequencyRow
                    key={f.id}
                    freq={f}
                    selected={selectedRoot === f.id}
                    onSelect={() => onSelectRoot(f.id)}
                    onInfo={onInfo ? () => onInfo(f) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <Notices of={ROOT_FREQUENCIES} />
      </section>

      {showBeats && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-sm font-bold">גלי מוח</h3>
            <span className="txt-3 text-[11px]">מהאיטי למהיר</span>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => onSelectBeat(null)}
              className={`glass w-full rounded-2xl p-3 text-right text-sm font-semibold transition-all ${
                selectedBeat === null ? 'rim' : ''
              }`}
              style={{ background: selectedBeat === null ? 'var(--accent-soft)' : undefined }}
            >
              ללא שכבת גל מוחי
            </button>
            {BEAT_FREQUENCIES.map((f) => (
              <FrequencyRow
                key={f.id}
                freq={f}
                selected={selectedBeat === f.id}
                onSelect={() => onSelectBeat(f.id)}
                onInfo={onInfo ? () => onInfo(f) : undefined}
              />
            ))}
          </div>
          <Notices of={BEAT_FREQUENCIES} />
        </section>
      )}
    </div>
  )
}
