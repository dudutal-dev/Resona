import {
  BEAT_FREQUENCIES,
  JOURNEYS,
  ROOT_FREQUENCIES,
  freqInfo,
  freqLabel,
  getFrequency,
  getJourney,
  journeyTitle,
} from '../lib/catalog'
import { GLYPH_FOR_THEME, glyphForFrequency } from '../lib/glyphs'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { themeOf } from '../lib/themes'
import { useSession } from '../store/sessionStore'
import { useJourneys } from '../store/journeyStore'
import { AppBar, SectionHead } from './AppBar'
import { HistoryPanel } from './HistoryPanel'
import { Tile } from './Tile'

/**
 * The piece of the day.
 *
 * Deterministic from the date rather than random: the home screen has to be the
 * same all day, or the thing you meant to come back to after lunch is gone. It
 * changes at midnight and it is the same for the whole catalogue rotation, so
 * over a couple of weeks it walks the whole shelf.
 */
function featuredFor(date: Date) {
  const day = Math.floor(date.getTime() / 86_400_000)
  return ROOT_FREQUENCIES[day % ROOT_FREQUENCIES.length]
}

export function HomeScreen() {
  const { t, lang } = useT()
  const { config, isPlaying, setRoot, toggle } = useSession()
  const progress = useJourneys((s) => s.progress)

  const featured = featuredFor(new Date())
  const inProgress = Object.values(progress)
    .map((p) => ({ p, journey: getJourney(p.journeyId) }))
    .filter((x) => x.journey && x.p.completedDays.length < x.journey.days)

  const sets = JOURNEYS.filter((j) => j.purpose === 'club').reverse().slice(0, 6)
  const quick = ROOT_FREQUENCIES.slice(0, 8)
  const bands = BEAT_FREQUENCIES.slice(0, 6)

  const playFeatured = async () => {
    setRoot(featured.id)
    if (!isPlaying || config.rootId !== featured.id) {
      navigate('/player')
      // A fresh session, not a resume: the hero is an invitation to start this
      // particular piece, so it restarts rather than picking up whatever was
      // already running under a different root.
      if (isPlaying) await toggle()
      await toggle()
    } else {
      navigate('/player')
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 safe-top">
      <AppBar title={t('nav.home')} />

      {/* The one thing on this screen that is a proposal rather than a list. */}
      <section className="hero p-5" style={{ ['--hero-h' as string]: String(featured.hue) }}>
        <p
          className="relative flex items-center gap-1.5 text-[11px] font-extrabold"
          style={{ color: 'var(--gold)', letterSpacing: '0.16em' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2l1.9 6.4a2 2 0 001.7 1.7L22 12l-6.4 1.9a2 2 0 00-1.7 1.7L12 22l-1.9-6.4a2 2 0 00-1.7-1.7L2 12l6.4-1.9a2 2 0 001.7-1.7z" />
          </svg>
          {t('home.featured')}
        </p>
        <h2 className="relative mt-2.5 text-[25px] font-extrabold leading-[1.12] tracking-tight">
          {freqLabel(featured, lang)} — <span className="readout">{featured.hz}Hz</span>
        </h2>
        <p className="txt-2 relative mt-2.5 line-clamp-2 text-[13px] leading-relaxed">
          {freqInfo(featured, lang)}
        </p>
        <div className="relative mt-5 flex justify-start">
          <button onClick={() => void playFeatured()} className="cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
            </svg>
            {t('home.startListening')}
          </button>
        </div>
      </section>

      {inProgress.length > 0 && (
        <>
          <SectionHead title={t('home.activeJourney')} onAll={() => navigate('/journeys')} allLabel={t('home.seeAll')} />
          <div className="grid grid-cols-2 gap-2.5">
            {inProgress.slice(0, 4).map(({ p, journey }) => (
              <Tile
                key={p.journeyId}
                hue={featured.hue}
                glyph={GLYPH_FOR_THEME[themeOf(journey!)]}
                title={journeyTitle(journey!, lang)}
                meta={`${p.completedDays.length}/${journey!.days}`}
                onClick={() => navigate(`/journey/${p.journeyId}`)}
              />
            ))}
          </div>
        </>
      )}

      <SectionHead title={t('home.quick')} onAll={() => navigate('/frequencies')} allLabel={t('home.seeAll')} />
      <div className="grid grid-cols-2 gap-2.5">
        {quick.map((f) => (
          <Tile
            key={f.id}
            hue={f.hue}
            glyph={glyphForFrequency(f)}
            title={freqLabel(f, lang)}
            meta={`${f.hz} Hz`}
            playing={isPlaying && config.rootId === f.id}
            onClick={() => {
              setRoot(f.id)
              navigate('/player')
            }}
          />
        ))}
      </div>

      <SectionHead title={t('home.shelfSessions')} onAll={() => navigate('/journeys')} allLabel={t('home.seeAll')} />
      <div className="grid grid-cols-2 gap-2.5">
        {sets.map((j) => (
          <Tile
            key={j.id}
            hue={getFrequency(j.schedule[0].frequencyId)?.hue ?? 265}
            glyph={GLYPH_FOR_THEME[themeOf(j)]}
            title={journeyTitle(j, lang)}
            meta={t('common.stagesN', { n: j.days })}
            onClick={() => navigate(`/journey/${j.id}`)}
          />
        ))}
      </div>

      <SectionHead title={t('home.bands')} onAll={() => navigate('/frequencies')} allLabel={t('home.seeAll')} />
      <div className="grid grid-cols-2 gap-2.5">
        {bands.map((f) => (
          <Tile
            key={f.id}
            hue={f.hue}
            glyph={glyphForFrequency(f)}
            title={freqLabel(f, lang)}
            meta={f.range ? `${f.range[0]}–${f.range[1]} Hz` : ''}
            onClick={() => navigate('/frequencies')}
          />
        ))}
      </div>

      <div className="mt-10">
        <HistoryPanel />
      </div>

      <p className="txt-3 mt-6 px-1 text-[11px] leading-relaxed">{t('home.disclaimer')}</p>
    </div>
  )
}
