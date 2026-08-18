import {
  JOURNEYS,
  ROOT_FREQUENCIES,
  freqLabel,
  getFrequency,
  getJourney,
  journeyTitle,
} from '../lib/catalog'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { usePresets } from '../store/presetsStore'
import { useJourneys } from '../store/journeyStore'
import { formatClock } from './ui'
import { Shelf, ShelfCard } from './Shelf'
import { coverForRoot, frequencyCover, journeyCover } from '../lib/cover'
import { HistoryPanel } from './HistoryPanel'

export function HomeScreen() {
  const { t, lang } = useT()
  const { config, isPlaying, elapsed, setRoot } = useSession()
  const presets = usePresets((s) => s.presets)
  const progress = useJourneys((s) => s.progress)

  const root = getFrequency(config.rootId)
  const inProgress = Object.values(progress)
    .map((p) => ({ p, journey: getJourney(p.journeyId) }))
    .filter((x) => x.journey && x.p.completedDays.length < x.journey.days)

  const hour = new Date().getHours()
  const greeting =
    hour < 5
      ? 'home.greet.night'
      : hour < 12
        ? 'home.greet.morning'
        : hour < 18
          ? 'home.greet.afternoon'
          : 'home.greet.evening'

  // Newest first: the club shelf is where new sets land, and a catalogue that
  // always opens on the same six is a catalogue nobody scrolls twice.
  const sets = JOURNEYS.filter((j) => j.purpose === 'club').reverse().slice(0, 12)
  const trips = JOURNEYS.filter((j) => j.purpose === 'psychedelic').slice(0, 10)
  const starters = JOURNEYS.filter(
    (j) => j.days <= 5 && j.purpose !== 'club' && j.purpose !== 'psychedelic',
  ).slice(0, 10)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-40 safe-top">
      <header className="pb-5 pt-4">
        <p className="txt-3 text-[13px] font-semibold">{t(greeting)}</p>
        <h1 className="glow-text mt-1 text-[32px] font-extrabold tracking-tight">Resona</h1>
      </header>

      {/* Continue listening — the one row that is about what you were doing
          rather than about what there is. */}
      <button
        onClick={() => navigate('/player')}
        className="bar flex w-full items-center gap-3 rounded-[14px] p-2.5 text-start transition-transform active:scale-[0.99]"
      >
        <img
          src={coverForRoot(config.rootId)}
          alt=""
          className="h-14 w-14 shrink-0 rounded-[8px] object-cover"
          style={{ boxShadow: '0 8px 18px -8px rgba(0,0,0,0.7)' }}
        />
        <span className="min-w-0 flex-1">
          <span className="txt-3 block text-[10px] font-bold uppercase" style={{ letterSpacing: '0.14em' }}>
            {t(isPlaying ? 'home.nowPlaying' : 'home.continue')}
          </span>
          <span className="mt-0.5 block truncate text-[15px] font-bold">
            {root ? freqLabel(root, lang) : ''}
          </span>
          <span className="txt-3 readout block text-[11px]">
            {isPlaying ? formatClock(elapsed) : `${root?.hz} Hz`}
          </span>
        </span>
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--pill-solid-bg)', color: 'var(--pill-solid-fg)' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
          </svg>
        </span>
      </button>

      {/* Journey in progress */}
      {inProgress.length > 0 && (
        <Shelf title={t('home.activeJourney')} onAll={() => navigate('/journeys')} allLabel={t('home.seeAll')}>
          {inProgress.map(({ p, journey }) => (
            <ShelfCard
              key={p.journeyId}
              cover={journeyCover(journey!)}
              title={journeyTitle(journey!, lang)}
              subtitle={`${p.completedDays.length}/${journey!.days}`}
              onClick={() => navigate(`/journey/${p.journeyId}`)}
            />
          ))}
        </Shelf>
      )}

      <Shelf title={t('home.shelfSessions')} onAll={() => navigate('/journeys')} allLabel={t('home.seeAll')}>
        {sets.map((j) => (
          <ShelfCard
            key={j.id}
            cover={journeyCover(j)}
            title={journeyTitle(j, lang)}
            subtitle={t('common.daysN', { n: j.days })}
            onClick={() => navigate(`/journey/${j.id}`)}
          />
        ))}
      </Shelf>

      <Shelf title={t('home.shelfTrips')} onAll={() => navigate('/journeys')} allLabel={t('home.seeAll')}>
        {trips.map((j) => (
          <ShelfCard
            key={j.id}
            cover={journeyCover(j)}
            title={journeyTitle(j, lang)}
            subtitle={t('common.daysN', { n: j.days })}
            onClick={() => navigate(`/journey/${j.id}`)}
          />
        ))}
      </Shelf>

      <Shelf title={t('home.shelfStarters')} onAll={() => navigate('/journeys')} allLabel={t('home.seeAll')}>
        {starters.map((j) => (
          <ShelfCard
            key={j.id}
            cover={journeyCover(j)}
            title={journeyTitle(j, lang)}
            subtitle={t('common.daysN', { n: j.days })}
            onClick={() => navigate(`/journey/${j.id}`)}
          />
        ))}
      </Shelf>

      <Shelf title={t('home.shelfRoots')} onAll={() => navigate('/frequencies')} allLabel={t('home.seeAll')}>
        {ROOT_FREQUENCIES.slice(0, 12).map((f) => (
          <ShelfCard
            key={f.id}
            cover={frequencyCover(f)}
            title={freqLabel(f, lang)}
            subtitle={`${f.hz} Hz`}
            onClick={() => {
              setRoot(f.id)
              navigate('/player')
            }}
          />
        ))}
      </Shelf>

      {presets.length > 0 && (
        <Shelf title={t('home.myPresets')} onAll={() => navigate('/presets')} allLabel={t('home.seeAll')}>
          {presets.slice(0, 10).map((preset) => (
            <ShelfCard
              key={preset.id}
              cover={coverForRoot(preset.config.rootId)}
              title={preset.name}
              onClick={() => navigate('/presets')}
            />
          ))}
        </Shelf>
      )}

      {/* Below the shelves, because it is a record rather than a destination. */}
      <div className="mt-8">
        <HistoryPanel />
      </div>

      <p className="txt-3 mt-6 px-1 text-[11px] leading-relaxed">{t('home.disclaimer')}</p>
    </div>
  )
}
