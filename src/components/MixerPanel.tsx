import { useEffect, useRef, useState } from 'react'
import { BUILTIN_AMBIENCE, type AmbienceOption } from '../audio/Ambience'
import { clubBpm } from '../audio/ClubGroove'
import { BASS_MAX_DB, BASS_MIN_DB } from '../audio/ToneEngine'
import { player } from '../audio/SessionPlayer'
import { getFrequency, shortLabel, styleKey, styleNoteKey } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { MELODY_STYLES, type ClubStyle } from '../lib/types'
import { useSession } from '../store/sessionStore'
import { ListeningMode } from './ListeningMode'
import { Slider } from './ui'

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
const BassIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M3 12c1.6-6 3.2-6 4.8 0s3.2 6 4.8 0"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M14 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
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
  const { config, setLevel, setAmbience, setBeatHz, setDensity, setPace, setDepth, setStyle, setBass } =
    useSession()
  const { t, rich, lang } = useT()
  const [ambienceOptions, setAmbienceOptions] = useState<AmbienceOption[]>(BUILTIN_AMBIENCE)
  const styleRow = useRef<HTMLDivElement | null>(null)
  const activeChip = useRef<HTMLButtonElement | null>(null)

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

  // The styles do not fit on one line, so opening the panel on a journey day
  // could leave the day's own style scrolled out of sight. Scrolling the row
  // itself rather than calling scrollIntoView keeps the page where it was.
  useEffect(() => {
    const row = styleRow.current
    const chip = activeChip.current
    if (!row || !chip) return
    row.scrollTo({ left: chip.offsetLeft - (row.clientWidth - chip.clientWidth) / 2 })
  }, [style])

  return (
    <div className="space-y-5">
      {/* Melody layer */}
      <div className="obj rounded-3xl p-4">
        <Slider
          label={t('mixer.melody')}
          icon={<WaveIcon />}
          value={config.levels.melody}
          onChange={(v) => setLevel('melody', v)}
        />
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
          {/* The club engine is reachable from journeys and is stored with the
              session, so it needs a control here — otherwise a techno day would
              quietly follow the listener into every session after it. */}
          <div>
            <p className="rule-label">{t('mixer.styleTitle')}</p>
            <div
              ref={styleRow}
              className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1"
            >
              {MELODY_STYLES.map((id) => {
                const active = style === id
                return (
                  <button
                    key={id}
                    ref={active ? activeChip : undefined}
                    onClick={() => setStyle(id)}
                    aria-pressed={active}
                    className="shrink-0 rounded-[4px] px-4 py-2 text-xs font-semibold transition-all active:scale-95"
                    style={{
                      background: active ? 'var(--gold-soft)' : 'var(--obj)',
                      border: `1px solid ${active ? 'var(--gold)' : 'var(--obj-line)'}`,
                      color: active ? 'var(--gold)' : 'var(--txt-2)',
                    }}
                  >
                    {t(styleKey(id))}
                  </button>
                )
              })}
            </div>
          </div>
          <Slider
            label={t('mixer.density')}
            value={config.density}
            onChange={setDensity}
            display={t(
              config.density < 0.33
                ? 'mixer.density.sparse'
                : config.density < 0.7
                  ? 'mixer.density.balanced'
                  : 'mixer.density.flowing',
            )}
          />
          <Slider
            label={t('mixer.pace')}
            value={config.pace}
            onChange={setPace}
            display={
              club
                ? `${Math.round(clubBpm(style as ClubStyle, config.pace))} BPM`
                : t(
                    config.pace < 0.25
                      ? 'mixer.pace.still'
                      : config.pace < 0.45
                        ? 'mixer.pace.drifting'
                        : config.pace < 0.7
                          ? 'mixer.pace.pulsing'
                          : 'mixer.pace.rhythmic',
                  )
            }
          />
          <Slider
            label={t('mixer.depth')}
            value={config.depth}
            onChange={setDepth}
            display={
              t(
                config.depth < 0.2
                  ? 'mixer.depth.clean'
                  : config.depth < 0.5
                    ? 'mixer.depth.floating'
                    : config.depth < 0.8
                      ? 'mixer.depth.psychedelic'
                      : 'mixer.depth.deep',
              )
            }
          />
          {config.depth >= 0.5 && (
            <p className="txt-3 text-[11px] leading-relaxed">
              {rich('mixer.depthNote')}
            </p>
          )}
          {club ? (
            <p className="txt-3 text-[11px] leading-relaxed">
              {t(styleNoteKey(style as ClubStyle))}
              {root?.hz ? rich('mixer.kickNote', { hz: root.hz }) : t('mixer.kickNoteNoHz')}
            </p>
          ) : (
            config.pace >= 0.45 && (
              <p className="txt-3 text-[11px] leading-relaxed">
                {t('mixer.pulseNote')}
              </p>
            )
          )}
        </div>
      </div>

      {/* Brainwave layer */}
      <div className="obj rounded-3xl p-4">
        <Slider
          label={t('mixer.beat')}
          icon={<BrainIcon />}
          value={config.levels.beat}
          onChange={(v) => setLevel('beat', v)}
        />
        {beat ? (
          <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
            <Slider
              label={t('mixer.beatRate', { band: shortLabel(beat, lang) })}
              min={range[0]}
              max={range[1]}
              // A half-Hz step across a two-Hz band leaves four positions and
              // cannot reach 7.83, which is the entire point of that band.
              step={range[1] - range[0] <= 5 ? 0.01 : 0.5}
              value={Math.min(range[1], Math.max(range[0], config.beatHz))}
              onChange={setBeatHz}
              display={`${config.beatHz} Hz`}
            />
          </div>
        ) : (
          <p className="txt-3 mt-2 text-[11px]">
            {t('mixer.noBeat')}
          </p>
        )}
      </div>

      {/* How the listener is set up — always available, beat layer or not. */}
      <ListeningMode hasBeatLayer={!!beat} />

      {/* Ambience layer */}
      <div className="obj rounded-3xl p-4">
        <Slider
          label={t('mixer.ambience')}
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
                className="shrink-0 rounded-[4px] px-4 py-2 text-xs font-semibold transition-all"
                style={{
                  background: active ? 'var(--gold-soft)' : 'var(--obj)',
                  border: `1px solid ${active ? 'var(--gold)' : 'var(--obj-line)'}`,
                  color: active ? 'var(--gold)' : 'var(--txt-2)',
                }}
              >
                {opt.labelKey ? t(opt.labelKey) : (opt.label ?? String(opt.id))}
              </button>
            )
          })}
        </div>
      </div>

      {/* Output: how loud, and how much weight underneath it. */}
      <div className="obj rounded-3xl p-4">
        <Slider
          label={t('mixer.master')}
          value={config.levels.master}
          onChange={(v) => setLevel('master', v)}
        />
        <div className="mt-4">
          <Slider
            label={t('mixer.bass')}
            icon={<BassIcon />}
            min={BASS_MIN_DB}
            max={BASS_MAX_DB}
            step={1}
            value={config.bass ?? 0}
            onChange={setBass}
            display={`${(config.bass ?? 0) > 0 ? '+' : ''}${config.bass ?? 0} dB`}
          />
          <p className="txt-3 mt-2 text-[11px] leading-relaxed">{t('mixer.bassNote')}</p>
        </div>
      </div>
    </div>
  )
}
