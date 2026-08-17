import { useState } from 'react'
import { useSession } from '../store/sessionStore'
import { usePresets } from '../store/presetsStore'
import { useJourneys } from '../store/journeyStore'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
import { useT } from '../lib/i18n'
import type { Frequency, MoodScore } from '../lib/types'
import { navigate } from '../lib/router'
import { Visualizer } from './Visualizer'
import { MixerPanel } from './MixerPanel'
import { TimerControl } from './TimerControl'
import { OutputControl } from './OutputControl'
import { InfoPanel } from './InfoPanel'
import { FrequencyPicker } from './FrequencyPicker'
import { Screen, Sheet, TrustBadge, formatClock } from './ui'
import { MoodPicker } from './MoodPicker'

export function PlayerScreen() {
  const { t, lang } = useT()
  const {
    config,
    isPlaying,
    isFading,
    elapsed,
    toggle,
    stop,
    setRoot,
    setBeat,
    activeJourney,
  } = useSession()
  const savePreset = usePresets((s) => s.save)
  const completeDay = useJourneys((s) => s.completeDay)

  const [infoFreq, setInfoFreq] = useState<Frequency | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saved, setSaved] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  const root = getFrequency(config.rootId)
  const beat = config.beatId ? getFrequency(config.beatId) : null
  const journey = activeJourney ? getJourney(activeJourney.journeyId) : null

  const handleSave = () => {
    savePreset(
      presetName ||
        `${root ? freqLabel(root, lang) : t('player.defaultPresetName')} · ${new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB')}`,
      config,
    )
    setSaved(true)
    setPresetName('')
    setSaveOpen(false)
    setTimeout(() => setSaved(false), 2200)
  }

  const handleFinishDay = (mood: MoodScore) => {
    if (activeJourney) completeDay(activeJourney.journeyId, activeJourney.day, mood)
    setFinishOpen(false)
    void stop()
    navigate(`/journey/${activeJourney?.journeyId ?? ''}`)
  }

  return (
    <Screen
      title={t('player.title')}
      subtitle={
        journey
          ? `${journeyTitle(journey, lang)} · ${t('common.dayN', { n: activeJourney?.day ?? 0 })}`
          : t('player.subtitle')
      }
      onBack
      action={
        <button
          onClick={() => root && setInfoFreq(root)}
          className="btn h-10 w-10 rounded-full p-0"
          aria-label={t('player.infoAria')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 8h.01M11 11h1v5h1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      }
    >
      {/* ---- Orb ------------------------------------------------------------ */}
      <div className={`transition-opacity duration-1000 ${isFading ? 'opacity-45' : 'opacity-100'}`}>
        <Visualizer playing={isPlaying}>
          <div className="animate-fade-up">
            <div className="ltr glow-text text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">
              {root?.hz ?? '—'}
            </div>
            <div className="txt-3 ltr -mt-1 text-sm font-medium">Hz</div>
            <div className="mt-2 max-w-[10rem] text-[13px] font-medium leading-tight txt-2">
              {root ? freqLabel(root, lang) : ''}
            </div>
            {isPlaying && (
              <div className="ltr mt-2 text-xs tabular-nums txt-3">{formatClock(elapsed)}</div>
            )}
          </div>
        </Visualizer>
      </div>

      {/* ---- Transport ------------------------------------------------------ */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={() => setPickerOpen(true)} className="btn h-12 rounded-2xl px-4 text-xs">
          {t('player.change')}
        </button>

        <button
          onClick={() => void toggle()}
          className="btn btn-primary relative h-20 w-20 rounded-full p-0"
          aria-label={t(isPlaying ? 'common.stop' : 'common.play')}
        >
          {isPlaying && (
            <span
              className="absolute inset-0 animate-pulse-ring rounded-full"
              style={{ border: '2px solid hsl(var(--h) 95% 70% / 0.5)' }}
              aria-hidden
            />
          )}
          {isPlaying ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4" height="14" rx="1.5" />
              <rect x="14" y="5" width="4" height="14" rx="1.5" />
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => (activeJourney ? setFinishOpen(true) : setSaveOpen(true))}
          className="btn h-12 rounded-2xl px-4 text-xs"
        >
          {activeJourney ? t('player.finishDay') : saved ? t('player.saved') : t('player.savePreset')}
        </button>
      </div>

      {/* ---- Active layers summary ------------------------------------------ */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {root && (
          <button onClick={() => setInfoFreq(root)} className="chip">
            <span className="ltr">{root.hz} Hz</span> · {freqLabel(root, lang)}
          </button>
        )}
        {beat && (
          <button onClick={() => setInfoFreq(beat)} className="chip">
            <span className="ltr">{config.beatHz} Hz</span> · {shortLabel(beat, lang)}
          </button>
        )}
        {root && <TrustBadge trust={root.trust} />}
      </div>

      {/* ---- Panels ---------------------------------------------------------- */}
      <div className="mt-7 space-y-5">
        <MixerPanel />
        <TimerControl />
        <OutputControl />
      </div>

      {/* ---- Sheets ---------------------------------------------------------- */}
      <InfoPanel freq={infoFreq} open={!!infoFreq} onClose={() => setInfoFreq(null)} />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('player.pickerTitle')}>
        <FrequencyPicker
          selectedRoot={config.rootId}
          selectedBeat={config.beatId}
          onSelectRoot={(id) => {
            setRoot(id)
            setPickerOpen(false)
          }}
          onSelectBeat={setBeat}
          onInfo={(f) => {
            setPickerOpen(false)
            setInfoFreq(f)
          }}
        />
      </Sheet>

      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} title={t('player.saveTitle')}>
        <label className="block text-sm font-medium" htmlFor="preset-name">
          {t('player.presetName')}
        </label>
        <input
          id="preset-name"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder={t('player.presetPlaceholder', { root: root ? freqLabel(root, lang) : '' })}
          className="glass mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2"
          style={{ color: 'var(--txt)' }}
          autoFocus
        />
        <p className="txt-3 mt-3 text-[11px] leading-relaxed">
          {t('player.saveNote')}
        </p>
        <button onClick={handleSave} className="btn btn-primary mt-4 w-full">
          {t('common.save')}
        </button>
      </Sheet>

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title={t('player.finishTitle')}>
        <p className="txt-2 mb-4 text-sm">
          {t('player.finishNote')}
        </p>
        <MoodPicker onPick={handleFinishDay} />
      </Sheet>
    </Screen>
  )
}
