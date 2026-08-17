import { useT } from '../lib/i18n'
import { useSession } from '../store/sessionStore'

const HeadphonesIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M4 14v-2a8 8 0 1116 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="2.5" y="13.5" width="4.5" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
    <rect x="17" y="13.5" width="4.5" height="7" rx="2" stroke="currentColor" strokeWidth="1.7" />
  </svg>
)

const SpeakerIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M5 9.5v5h3.5L13 18.5v-13L8.5 9.5H5z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M16.5 9.5a4 4 0 010 5M19 7a7.5 7.5 0 010 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

/**
 * "How are you listening?" — the same question the opening sheet asks, kept
 * available for the rest of the app's life rather than only once.
 *
 * It is phrased as headphones-or-speakers rather than binaural-or-isochronic
 * because that is the thing the listener actually knows about their own setup;
 * the rendering mode is the consequence, not the question.
 *
 * `hasBeatLayer` exists so the component can be honest on a session with no
 * brainwave layer — most solfeggio journey days — where the choice changes
 * nothing you can hear right now.
 */
export function ListeningMode({
  hasBeatLayer,
  compact = false,
}: {
  hasBeatLayer: boolean
  compact?: boolean
}) {
  const { t } = useT()
  const mode = useSession((s) => s.config.beatMode)
  const setBeatMode = useSession((s) => s.setBeatMode)

  const options = [
    {
      id: 'binaural' as const,
      label: t('listen.headphones'),
      hint: t('listen.headphonesHint'),
      icon: <HeadphonesIcon />,
    },
    {
      id: 'isochronic' as const,
      label: t('listen.speakers'),
      hint: t('listen.speakersHint'),
      icon: <SpeakerIcon />,
    },
  ]

  return (
    <div className={compact ? '' : 'glass rounded-3xl p-4'}>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-bold">{t('listen.question')}</h3>
        {!hasBeatLayer && <span className="txt-3 text-[11px]">{t('listen.savedForLater')}</span>}
      </div>

      <div className="flex gap-2" role="group" aria-label={t('listen.groupAria')}>
        {options.map((opt) => {
          const active = mode === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setBeatMode(opt.id)}
              aria-pressed={active}
              className={`flex-1 rounded-2xl px-3 py-3 text-start transition-all active:scale-[0.98] ${
                active ? 'rim' : ''
              }`}
              style={{
                background: active ? 'var(--accent-soft)' : 'var(--card)',
                border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
              }}
            >
              <span
                className="mb-1.5 block"
                style={{ color: active ? 'var(--accent)' : 'var(--txt-3)' }}
              >
                {opt.icon}
              </span>
              <span className="block text-sm font-semibold">{opt.label}</span>
              <span className="txt-3 mt-0.5 block text-[10px] leading-tight">{opt.hint}</span>
            </button>
          )
        })}
      </div>

      {hasBeatLayer ? (
        mode === 'binaural' && (
          <p
            className="mt-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
            style={{
              background: 'rgba(255,209,102,0.1)',
              border: '1px solid rgba(255,209,102,0.25)',
              color: '#ffd166',
            }}
          >
            {t('listen.binauralWarning')}
          </p>
        )
      ) : (
        <p className="txt-3 mt-2 text-[11px] leading-relaxed">
          {t('listen.noBeatNote')}
        </p>
      )}
    </div>
  )
}
