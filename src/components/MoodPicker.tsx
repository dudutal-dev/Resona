import type { MoodScore } from '../lib/types'

const MOODS: { score: MoodScore; label: string; face: string }[] = [
  { score: 1, label: 'קשה', face: '😣' },
  { score: 2, label: 'לא משהו', face: '😕' },
  { score: 3, label: 'בסדר', face: '😐' },
  { score: 4, label: 'טוב', face: '🙂' },
  { score: 5, label: 'מצוין', face: '😌' },
]

/** The 1-5 daily mood log from §6.4. Optional by design — never blocks progress. */
export function MoodPicker({
  value,
  onPick,
}: {
  value?: MoodScore
  onPick: (score: MoodScore) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {MOODS.map((m) => {
        const active = value === m.score
        return (
          <button
            key={m.score}
            onClick={() => onPick(m.score)}
            aria-pressed={active}
            className={`rounded-2xl px-1 py-3 transition-all active:scale-95 ${active ? 'rim' : ''}`}
            style={{
              background: active ? 'var(--accent-soft)' : 'var(--card)',
              border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
            }}
          >
            <span className="block text-2xl leading-none">{m.face}</span>
            <span className="txt-3 mt-1.5 block text-[10px] font-medium">{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}
