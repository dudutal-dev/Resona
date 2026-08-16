import { useEffect, useState } from 'react'
import { BUILTIN_AMBIENCE, type AmbienceOption } from '../audio/Ambience'
import { clubBpm } from '../audio/ClubGroove'
import { player } from '../audio/SessionPlayer'
import { getFrequency } from '../lib/catalog'
import type { MelodyStyle } from '../lib/types'
import { useSession } from '../store/sessionStore'
import { ListeningMode } from './ListeningMode'
import { Slider } from './ui'

const STYLES: { id: MelodyStyle; label: string }[] = [
  { id: 'ambient', label: 'אמביינט' },
  { id: 'techno', label: 'טכנו' },
  { id: 'trance', label: 'טראנס' },
]

const WaveIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 12h2l2-6 3 13 3-16 3 12 2-3h3"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
const BrainIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M12 5a3 3 0 00-6 .5A2.5 2.5 0 004 8a2.5 2.5 0 001 2 2.5 2.5 0 002 4h5V5zM12 5a3 3 0 016 .5A2.5 2.5 0 0120 8a2.5 2.5 0 01-1 2 2.5 2.5 0 01-2 4h-5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
)
const CloudIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M7 18h10a4 4 0 000-8 5 5 0 00-9.6-1.3A3.5 3.5 0 007 18z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
)

/** Per-layer volume plus the controls that shape each layer (§4.5). */
export function MixerPanel() {
  const { config, setLevel, setAmbience, setBeatHz, setDensity, setPace, setDepth, setStyle } =
    useSession()
  const [ambienceOptions, setAmbienceOptions] = useState<AmbienceOption[]>(BUILTIN_AMBIENCE)

  useEffect(() => {
    let alive = true
    void player.getAmbienceOptions().then((opts) => {
      if (alive) setAmbienceOptions(opts)
    })
    return () => {
      alive = false
    }
  }, [])

  const beat = config.beatId ? getFrequency(config.beatId) : null
  const range = beat?.range ?? [0.5, 50]
  const style = config.style ?? 'ambient'
  const club = style !== 'ambient'
  const root = getFrequency(config.rootId)

  return (
    <div className="space-y-5">
      {/* Melody layer */}
      <div className="glass rounded-3xl p-4">
        <Slider
          label="מלודיה ותדר יסוד"
          icon={<WaveIcon />}
          value={config.levels.melody}
          onChange={(v) => setLevel('melody', v)}
        />
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {/* The club engine is reachable from journeys and is stored with the
              session, so it needs a control here — otherwise a techno day would
              quietly follow the listener into every session after it. */}
          <div>
            <span className="txt-2 text-xs font-semibold">אופי המלודיה</span>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STYLES.map((s) => {
                const active = style === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    aria-pressed={active}
                    className="rounded-2xl px-2 py-2 text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: active ? 'var(--accent-soft)' : 'var(--card)',
                      border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                      color: active ? 'var(--accent)' : 'var(--txt-2)',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
          <Slider
            label="צפיפות נגינה"
            value={config.density}
            onChange={setDensity}
            display={config.density < 0.33 ? 'דלילה' : config.density < 0.7 ? 'מאוזנת' : 'זורמת'}
          />
          <Slider
            label="קצב"
            value={config.pace}
            onChange={setPace}
            display={
              club
                ? `${Math.round(clubBpm(style as 'techno' | 'trance', config.pace))} BPM`
                : config.pace < 0.25
                  ? 'נייח'
                  : config.pace < 0.45
                    ? 'זורם'
                    : config.pace < 0.7
                      ? 'פועם'
                      : 'קצבי'
            }
          />
          <Slider
            label="עומק"
            value={config.depth}
            onChange={setDepth}
            display={
              config.depth < 0.2
                ? 'נקי'
                : config.depth < 0.5
                  ? 'מרחף'
                  : config.depth < 0.8
                    ? 'פסיכדלי'
                    : 'עמוק'
            }
          />
          {config.depth >= 0.5 && (
            <p className="txt-3 text-[11px] leading-relaxed">
              מעל חצי הסולם עובר לסדרת ההרמוניות העליונה — מרווחים של{' '}
              <span className="ltr">7/4</span> ו-<span className="ltr">11/8</span> שאין להם מקבילה
              בפסנתר. עדיין יחסים שלמים מדויקים של תדר היסוד.
            </p>
          )}
          {club ? (
            <p className="txt-3 text-[11px] leading-relaxed">
              {style === 'techno'
                ? 'טכנו: קיק על כל פעימה, בס מתחתיו, האט בין הפעימות וארפג׳ שמתחלף כל ארבע תיבות.'
                : 'טראנס: שש עשרה תיבות נהיגה, ברייקדאון שבו הקיק נעלם, בילד עם פילטר עולה ודרופ. הבס יושב בין הפעימות.'}{' '}
              הקיק עצמו הוא{' '}
              {root?.hz ? (
                <>
                  <span className="ltr">{root.hz} Hz</span> מקופל אוקטבות מטה
                </>
              ) : (
                'תדר היסוד מקופל אוקטבות מטה'
              )}
              , כך שגם הצליל החזק ביותר במיקס הוא התדר שבחרת.
            </p>
          ) : (
            config.pace >= 0.45 && (
              <p className="txt-3 text-[11px] leading-relaxed">
                מעל "פועם" נכנסת פעימת בס על תדר היסוד, התווים מתקצרים והנגיעה נעשית נקישה במקום
                התנפחות.
              </p>
            )
          )}
        </div>
      </div>

      {/* Brainwave layer */}
      <div className="glass rounded-3xl p-4">
        <Slider
          label="גל מוחי"
          icon={<BrainIcon />}
          value={config.levels.beat}
          onChange={(v) => setLevel('beat', v)}
        />
        {beat ? (
          <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <Slider
              label={`קצב פעימה — ${beat.label.split('—')[0].trim()}`}
              min={range[0]}
              max={range[1]}
              step={0.5}
              value={Math.min(range[1], Math.max(range[0], config.beatHz))}
              onChange={setBeatHz}
              display={`${config.beatHz} Hz`}
            />
          </div>
        ) : (
          <p className="txt-3 mt-2 text-[11px]">
            שכבת הגל המוחי כבויה בהאזנה הזו. אפשר להוסיף טווח במסך התדרים.
          </p>
        )}
      </div>

      {/* How the listener is set up — always available, beat layer or not. */}
      <ListeningMode hasBeatLayer={!!beat} />

      {/* Ambience layer */}
      <div className="glass rounded-3xl p-4">
        <Slider
          label="סאונד סביבה"
          icon={<CloudIcon />}
          value={config.levels.ambience}
          onChange={(v) => setLevel('ambience', v)}
        />
        <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {ambienceOptions.map((opt) => {
            const active = config.ambience === opt.id
            return (
              <button
                key={String(opt.id)}
                onClick={() => setAmbience(opt.id)}
                aria-pressed={active}
                className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  background: active ? 'var(--accent-soft)' : 'var(--card)',
                  border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                  color: active ? 'var(--accent)' : 'var(--txt-2)',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Master */}
      <div className="glass rounded-3xl p-4">
        <Slider
          label="עוצמה כללית"
          value={config.levels.master}
          onChange={(v) => setLevel('master', v)}
        />
      </div>
    </div>
  )
}
