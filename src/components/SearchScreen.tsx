import { useMemo, useState } from 'react'
import {
  FREQUENCIES,
  ROOT_FREQUENCIES,
  allJourneys,
  freqInfo,
  freqLabel,
  getFrequency,
  journeyTitle,
} from '../lib/catalog'
import { GLYPH_FOR_THEME, glyphForFrequency } from '../lib/glyphs'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { themeOf } from '../lib/themes'
import { useSession } from '../store/sessionStore'
import { AppBar, SectionHead } from './AppBar'
import { Tile } from './Tile'

/**
 * One field over the whole catalogue.
 *
 * It matches on everything a person might have in mind — the name, the number,
 * and the explanatory text — because nobody remembers that the tone they want
 * is called "expression and problem solving", they remember that it was the one
 * about speaking up. Searching the prose is what makes that findable.
 *
 * Numbers are matched as text on purpose: typing `52` should surface 528 while
 * you are still typing it, which a numeric comparison would not do.
 */
export function SearchScreen() {
  const { t, lang } = useT()
  const [q, setQ] = useState('')
  const setRoot = useSession((s) => s.setRoot)

  const query = q.trim().toLowerCase()
  const { freqs, journeys } = useMemo(() => {
    if (query.length === 0) return { freqs: [], journeys: [] }
    const hay = (...parts: (string | number | undefined)[]) =>
      parts.filter(Boolean).join(' ').toLowerCase().includes(query)
    return {
      freqs: FREQUENCIES.filter((f) =>
        hay(f.label, f.labelEn, f.info, f.infoEn, f.hz, f.range?.join('-')),
      ),
      journeys: allJourneys().filter((j) =>
        hay(j.title, j.titleEn, j.description, j.descriptionEn),
      ),
    }
  }, [query])

  const total = freqs.length + journeys.length

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-44 safe-top">
      <AppBar title={t('search.title')} />

      <div className="obj flex items-center gap-3 p-3.5">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden style={{ color: 'var(--txt-3)' }}>
          <circle cx="11" cy="11" r="6.6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16l4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.title')}
          autoComplete="off"
          className="w-full bg-transparent text-[15px] font-bold outline-none placeholder:font-normal"
          style={{ color: 'var(--txt)' }}
        />
        {q && (
          <button onClick={() => setQ('')} aria-label={t('common.close')} className="shrink-0" style={{ color: 'var(--txt-3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {query.length === 0 && (
        <>
          <p className="txt-3 mt-5 px-1 text-[13px] leading-relaxed">{t('search.prompt')}</p>
          {/* An empty search screen is a dead end. Until something is typed it
              behaves as a shortcut shelf, which is what people use it for
              anyway — most searches here are a way of reaching one known tone
              faster than scrolling the library. */}
          <SectionHead title={t('home.quick')} />
          <div className="grid grid-cols-2 gap-2.5">
            {ROOT_FREQUENCIES.slice(0, 6).map((f) => (
              <Tile
                key={f.id}
                hue={f.hue}
                glyph={glyphForFrequency(f)}
                title={freqLabel(f, lang)}
                meta={`${f.hz} Hz`}
                onClick={() => {
                  setRoot(f.id)
                  navigate('/player')
                }}
              />
            ))}
          </div>
        </>
      )}

      {query.length > 0 && total === 0 && (
        <p className="txt-2 mt-8 px-1 text-center text-[14px]">{t('search.none', { q: `“${q}”` })}</p>
      )}

      {freqs.length > 0 && (
        <>
          <SectionHead title={t('search.freqs')} />
          <div className="grid grid-cols-2 gap-2.5">
            {freqs.map((f) => (
              <Tile
                key={f.id}
                hue={f.hue}
                glyph={glyphForFrequency(f)}
                title={freqLabel(f, lang)}
                meta={f.hz != null ? `${f.hz} Hz` : f.range ? `${f.range[0]}–${f.range[1]} Hz` : freqInfo(f, lang).slice(0, 40)}
                onClick={() => {
                  // Only a root can be the session's tone; a band is browsed.
                  if (f.hz != null && f.type !== 'binaural') {
                    setRoot(f.id)
                    navigate('/player')
                  } else {
                    navigate('/frequencies')
                  }
                }}
              />
            ))}
          </div>
        </>
      )}

      {journeys.length > 0 && (
        <>
          <SectionHead title={t('search.journeys')} />
          <div className="grid grid-cols-2 gap-2.5">
            {journeys.map((j) => (
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
        </>
      )}

      {total > 0 && (
        <p className="txt-3 mt-8 px-1 text-center text-[11px]">{t('search.resultsN', { n: total })}</p>
      )}
    </div>
  )
}
