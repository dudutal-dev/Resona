import { Suspense, lazy, useEffect, useState } from 'react'
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
import { CarrierNote } from './CarrierNote'
import { InfoPanel } from './InfoPanel'
import { FrequencyPicker } from './FrequencyPicker'
import { Sheet, TrustBadge, formatClock } from './ui'
import { ReleaseHeader } from './ReleaseHeader'
import { coverForRoot } from '../lib/cover'
import { MoodPicker } from './MoodPicker'
import { ShareButton, SharedInvite, SoundLostNotice } from './Share'

/**
 * Split off on its own: the television stage carries the figure's point cloud,
 * which is by a distance the largest thing in the build, and most sessions never
 * open it. It is fetched as soon as the player is on screen rather than when the
 * button is pressed, because it asks for fullscreen the moment it mounts and
 * that only works while the tap is still counted as a gesture.
 */
const TvStage = lazy(() => import('./TvStage').then((m) => ({ default: m.TvStage })))

/** Untouched for this long while playing, and the screen fades down. */
const DIM_AFTER_MS = 75_000

export function PlayerScreen({ rootId }: { rootId?: string } = {}) {
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
  const [tvOpen, setTvOpen] = useState(false)
  const [mixOpen, setMixOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [saved, setSaved] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)

  useEffect(() => {
    void import('./TvStage')
  }, [])

  /**
   * A frequency arrived in the address — someone was sent this exact one.
   *
   * Applied once per id and only if it names a frequency the app has: a link
   * with a typo in it should open the player as it was, not an empty screen.
   * The address is then rewritten to plain `#/player`, so going back to the
   * player later does not silently re-select it.
   */
  useEffect(() => {
    if (!rootId) return
    if (getFrequency(rootId)) setRoot(rootId)
    navigate('/player')
  }, [rootId])

  /**
   * The orb fades itself down while a session runs and nobody touches it.
   *
   * The television stage has done this since it was built, and the player — the
   * screen actually used for falling asleep, with the phone face up on the bed —
   * stayed at full brightness all night. The orb is the light: everything else
   * here is dark grey on black, so fading that one element takes almost all of
   * the emitted light out of the room while leaving the transport readable
   * enough to stop the session without waking the screen up first.
   *
   * It does not go entirely dark, because a black screen and a stopped session
   * look identical. Any touch or key brings it straight back.
   */
  const [dimmed, setDimmed] = useState(false)
  useEffect(() => {
    if (!isPlaying) {
      setDimmed(false)
      return
    }
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      setDimmed(false)
      timer = window.setTimeout(() => setDimmed(true), DIM_AFTER_MS)
    }
    arm()
    for (const event of ['pointerdown', 'keydown'] as const) {
      window.addEventListener(event, arm, { passive: true })
    }
    return () => {
      window.clearTimeout(timer)
      for (const event of ['pointerdown', 'keydown'] as const) {
        window.removeEventListener(event, arm)
      }
    }
  }, [isPlaying])

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

  // The cover follows the frequency, not the journey: it is what is sounding,
  // and it keeps the artwork from changing under you on the way in from a day
  // page or out to the docked card.
  const cover = coverForRoot(config.rootId)

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden px-4 pb-40 safe-top">
      <SharedInvite />
      <SoundLostNotice />
      <ReleaseHeader
        cover={cover}
        // What is shared from the player is the frequency it is on — a journey
        // has its own screen, and that is where a journey should be shared from.
        menu={<ShareButton target={{ kind: 'frequency', id: config.rootId }} size={19} />}
        art={
          isPlaying ? (
            <div
              className="h-full w-full transition-opacity duration-[2500ms]"
              style={{ opacity: dimmed ? 0.12 : isFading ? 0.45 : 1 }}
            >
              <Visualizer playing>
                <div>
                  <div className="readout glow-text text-4xl font-bold tracking-tight">
                    {root?.hz ?? '—'}
                  </div>
                  <div className="txt-3 readout -mt-0.5 text-xs font-medium">Hz</div>
                  <div className="readout mt-2 text-[11px] txt-3">{formatClock(elapsed)}</div>
                </div>
              </Visualizer>
            </div>
          ) : undefined
        }
        eyebrow={journey ? t('common.stageN', { n: activeJourney?.day ?? 0 }) : undefined}
        title={journey ? journeyTitle(journey, lang) : root ? freqLabel(root, lang) : 'Resona'}
        subtitle={
          journey
            ? t('player.byJourney')
            : beat
              ? t('player.withBand', { band: shortLabel(beat, lang), hz: config.beatHz })
              : t('player.rootOnly')
        }
        onSubtitle={
          journey ? () => navigate(`/journey/${journey.id}`) : () => setPickerOpen(true)
        }
        meta={
          <>
            {root && (
              <button onClick={() => setInfoFreq(root)} className="readout">
                {root.hz} Hz
              </button>
            )}
            {beat && (
              <>
                <span aria-hidden>·</span>
                <button onClick={() => setInfoFreq(beat)}>
                  {shortLabel(beat, lang)} <span className="readout">{config.beatHz} Hz</span>
                </button>
              </>
            )}
            {root && <TrustBadge trust={root.trust} />}
          </>
        }
        primary={{
          label: t(isPlaying ? 'common.stop' : 'common.play'),
          onClick: () => void toggle(),
          icon: isPlaying ? (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="4.2" height="14" rx="1" />
              <rect x="13.8" y="5" width="4.2" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
            </svg>
          ),
        }}
        secondary={{
          label: activeJourney ? t('player.finishDay') : t('player.change'),
          onClick: () => (activeJourney ? setFinishOpen(true) : setPickerOpen(true)),
          icon: activeJourney ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 7h11m0 0l-3-3m3 3l-3 3M20 17H9m0 0l3-3m-3 3l3 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ),
        }}
        actions={[
          {
            key: 'save',
            label: saved ? t('player.saved') : t('player.savePreset'),
            on: saved,
            onClick: () => setSaveOpen(true),
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} aria-hidden>
                <path
                  d="M12 20s-7-4.5-7-9.2A4 4 0 0112 8.5 4 4 0 0119 10.8C19 15.5 12 20 12 20z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
              </svg>
            ),
          },
          {
            key: 'info',
            label: t('player.credits'),
            onClick: () => root && setInfoFreq(root),
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
                <path d="M12 8h.01M11 11h1v5h1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            ),
          },
          {
            key: 'mix',
            label: t('player.mix'),
            onClick: () => setMixOpen(true),
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 21V14M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <path d="M2.5 14h5M9.5 8h5M16.5 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            ),
          },
          {
            key: 'tv',
            label: t('tv.enter'),
            onClick: () => setTvOpen(true),
            icon: (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="2.5" y="4.5" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
                <path d="M8 20.5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            ),
          },
        ]}
      />

      {/* What the two layers are doing to each other. */}
      <CarrierNote />

      {/* The timer is chosen per session, like the frequency, so it stays out
          here rather than moving into the mix sheet with the rest. */}
      <div className="mt-6">
        <TimerControl />
      </div>

      {tvOpen && (
        <Suspense fallback={null}>
          <TvStage onClose={() => setTvOpen(false)} />
        </Suspense>
      )}

      {/* ---- Sheets ---------------------------------------------------------- */}
      <Sheet open={mixOpen} onClose={() => setMixOpen(false)} title={t('player.mixTitle')}>
        <div className="space-y-5">
          <MixerPanel />
          <OutputControl />
        </div>
      </Sheet>

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
        <button onClick={handleSave} className="cta mt-4 w-full">
          {t('common.save')}
        </button>
      </Sheet>

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)} title={t('player.finishTitle')}>
        <p className="txt-2 mb-4 text-sm">
          {t('player.finishNote')}
        </p>
        <MoodPicker onPick={handleFinishDay} />
      </Sheet>
    </div>
  )
}
