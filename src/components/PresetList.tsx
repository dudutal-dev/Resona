import { useState } from 'react'
import { useT, type StringKey } from '../lib/i18n'
import { BUILTIN_AMBIENCE } from '../audio/Ambience'
import { getFrequency, getJourney, journeyTitle, purposeKey } from '../lib/catalog'
import { GLYPH_FOR_THEME } from '../lib/glyphs'
import { THEME_HUE, themeOf } from '../lib/themes'
import { useFavourites } from '../store/favouritesStore'
import { useJourneys } from '../store/journeyStore'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { usePresets } from '../store/presetsStore'
import type { Journey, Preset } from '../lib/types'
import { hueFill, hueLine, hueText } from '../lib/themes'
import { SectionHead } from './AppBar'
import { Badge } from './Badge'
import { FavouriteButton } from './FavouriteButton'
import { Card, EmptyState, Screen, Sheet } from './ui'

function describe(preset: Preset, t: (k: StringKey, v?: Record<string, string | number>) => string) {
  const root = getFrequency(preset.config.rootId)
  const beat = preset.config.beatId ? getFrequency(preset.config.beatId) : null
  const amb = BUILTIN_AMBIENCE.find((a) => a.id === preset.config.ambience)
  const parts = [root ? `${root.hz} Hz` : null, beat ? `${preset.config.beatHz} Hz` : null]
  const timer =
    preset.config.timerMode === 'custom'
      ? `${preset.config.customMinutes} ${t('common.min')}`
      : t(`timer.${preset.config.timerMode}` as StringKey)
  const ambience = amb?.labelKey ? t(amb.labelKey) : preset.ambienceTrack
  return [parts.filter(Boolean).join(' + '), ambience, timer].filter(Boolean).join(' · ')
}

export function PresetList() {
  const { t, lang } = useT()
  const { presets, remove, rename, update } = usePresets()
  // Resolved through the catalogue on every render, so a journey that no longer
  // exists — a built one that was deleted — simply stops appearing.
  const favIds = useFavourites((s) => s.ids)
  const favourites = favIds.map((id) => getJourney(id)).filter((j): j is Journey => !!j)
  const progress = useJourneys((s) => s.progress)
  const { config, loadConfig, toggle } = useSession()
  const [editing, setEditing] = useState<Preset | null>(null)
  const [name, setName] = useState('')

  const handlePlay = async (preset: Preset) => {
    loadConfig(preset.config, null)
    navigate('/player')
    // loadConfig writes synchronously through the store, so the player picks up
    // the new config on this same tick.
    await toggle()
  }

  return (
    <Screen title={t('nav.favourites')}>
      {/*
        Two kinds of saved thing, and they are not the same kind.

        A favourite journey is a pointer into the catalogue — a week someone
        means to walk. A preset is a frozen set of dials. Putting them on one
        screen is right, because "the things I kept" is how a person thinks
        about them; merging them into one list would not be, because only one of
        them can be played by pressing it.
      */}
      {favourites.length > 0 && (
        <>
          <SectionHead
            title={t('fav.journeys')}
            onAll={() => navigate('/journeys')}
            allLabel={t('fav.toJourneys')}
            tight
          />
          {/*
            Full rows rather than the two-column grid the rest of the app uses.

            A favourite is not something being browsed — it has already been
            chosen, and there are rarely more than a handful. So each one gets
            the width to show its mark at the size it is drawn at everywhere
            else, its own colour, and how far through it you are, which is the
            thing you actually came to this screen to check.
          */}
          <div className="mb-2 space-y-2.5">
            {favourites.map((journey) => {
              const hue = THEME_HUE[themeOf(journey)]
              const done = progress[journey.id]?.completedDays.length ?? 0
              return (
                <div
                  key={journey.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/journey/${journey.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') navigate(`/journey/${journey.id}`)
                  }}
                  // A div, not a button: the star inside it is one, and a button
                  // inside a button is invalid markup that React warns about.
                  className="obj flex w-full cursor-pointer items-center gap-3.5 p-3.5 text-start"
                >
                  <Badge hue={hue} glyph={GLYPH_FOR_THEME[themeOf(journey)]} size={54} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-extrabold leading-tight">
                      {journeyTitle(journey, lang)}
                    </span>
                    <span className="txt-3 mt-1 block truncate text-[12px]">
                      {t(purposeKey(journey.purpose))} · {t('common.stagesN', { n: journey.days })}
                    </span>
                    {/* One bar per stage, the same reading as on the shelf. */}
                    <span className="mt-2 flex gap-1" aria-hidden>
                      {Array.from({ length: journey.days }, (_, i) => (
                        <span
                          key={i}
                          className="h-[3px] flex-1 rounded-full"
                          style={{
                            background: i < done ? hueText(hue) : 'var(--border)',
                          }}
                        />
                      ))}
                    </span>
                  </span>
                  <FavouriteButton journeyId={journey.id} size={18} />
                </div>
              )
            })}
          </div>
        </>
      )}

      {favourites.length > 0 && presets.length > 0 && <SectionHead title={t('presets.title')} />}

      {favourites.length === 0 && presets.length === 0 ? (
        <EmptyState
          title={t('fav.emptyTitle')}
          body={t('fav.emptyBody')}
          action={
            <button onClick={() => navigate('/journeys')} className="cta flex-none px-5 py-2.5 text-[13.5px]">
              {t('fav.toJourneys')}
            </button>
          }
        />
      ) : presets.length === 0 ? null : (
        <div className="space-y-2">
          {presets.map((preset) => {
            const root = getFrequency(preset.config.rootId)
            return (
              <Card key={preset.id}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => void handlePlay(preset)}
                    aria-label={t('presets.playAria', { name: preset.name })}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform active:scale-95"
                    style={{
                      background: hueFill(root?.hue ?? 265, 0.16),
                      border: `1px solid ${hueLine(root?.hue ?? 265, 0.42)}`,
                      color: hueText(root?.hue ?? 265),
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
                    </svg>
                  </button>

                  <button onClick={() => void handlePlay(preset)} className="min-w-0 flex-1 text-start">
                    <p className="truncate text-sm font-semibold">{preset.name}</p>
                    <p className="txt-3 ltr mt-0.5 truncate text-[11px]">{describe(preset, t)}</p>
                  </button>

                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditing(preset)
                        setName(preset.name)
                      }}
                      aria-label={t('presets.editAria', { name: preset.name })}
                      className="btn btn-ghost h-9 w-9 rounded-full p-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('presets.deleteConfirm', { name: preset.name }))) remove(preset.id)
                      }}
                      aria-label={t('presets.deleteAria', { name: preset.name })}
                      className="btn btn-ghost h-9 w-9 rounded-full p-0 txt-3"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t('presets.editTitle')}>
        <label className="block text-sm font-medium" htmlFor="rename">
          {t('presets.name')}
        </label>
        <input
          id="rename"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="glass mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ color: 'var(--txt)' }}
        />
        <button
          onClick={() => {
            if (editing) rename(editing.id, name)
            setEditing(null)
          }}
          className="cta mt-4 w-full"
        >
          {t('presets.saveName')}
        </button>
        <button
          onClick={() => {
            if (editing) update(editing.id, config)
            setEditing(null)
          }}
          className="obj mt-2 w-full rounded-full py-3.5 text-[13px] font-extrabold"
        >
          {t('presets.updateToCurrent')}
        </button>
      </Sheet>
    </Screen>
  )
}
