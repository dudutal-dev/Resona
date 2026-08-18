import type { ReactNode } from 'react'
import { freqLabel, getFrequency, getJourney, journeyTitle, shortLabel } from '../lib/catalog'
import { useT } from '../lib/i18n'
import { useHistory } from '../store/historyStore'

/** Whole days between a past moment and now, in the device's own timezone. */
function daysAgo(at: number): number {
  const then = new Date(at)
  const now = new Date()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((startOfDay(now) - startOfDay(then)) / 86400000)
}

/**
 * What has been listened to lately.
 *
 * Deliberately a list and not a chart: with twenty rows the pattern is legible
 * by reading it, and a graph of "minutes per frequency" would be a claim about
 * significance that twenty sessions cannot support.
 */
export function HistoryPanel() {
  const { t, rich, lang } = useT()
  const listens = useHistory((s) => s.listens)
  const clear = useHistory((s) => s.clear)

  if (!listens.length) {
    return (
      <section>
        <h2 className="text-[15px] font-extrabold tracking-tight">{t('history.title')}</h2>
        <p className="txt-3 mt-2 text-[12px] leading-relaxed">{t('history.empty')}</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold tracking-tight">{t('history.title')}</h2>
        <button onClick={clear} className="txt-3 text-[11px] underline underline-offset-2">
          {t('history.clear')}
        </button>
      </div>

      <ul className="mt-3 space-y-2">
        {listens.slice(0, 12).map((listen) => {
          const root = getFrequency(listen.rootId)
          const beat = listen.beatId ? getFrequency(listen.beatId) : null
          const journey = listen.journeyId ? getJourney(listen.journeyId) : null
          const days = daysAgo(listen.at)
          const when: ReactNode =
            days === 0
              ? t('history.today')
              : days === 1
                ? t('history.yesterday')
                : rich('history.daysAgo', { n: days })

          return (
            <li key={listen.id} className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">
                  <span className="readout">{root?.hz ?? '—'} Hz</span>
                  {root && <> · {freqLabel(root, lang)}</>}
                </p>
                <p className="txt-3 truncate text-[11px]">
                  {journey
                    ? `${journeyTitle(journey, lang)} · ${t('common.dayN', { n: listen.day ?? 0 })}`
                    : beat
                      ? `${beat ? shortLabel(beat, lang) : ''} · ${listen.beatHz} Hz`
                      : ''}
                </p>
              </div>
              <div className="shrink-0 text-end">
                <p className="readout text-[13px] font-semibold">
                  {rich('history.minutes', { n: Math.round(listen.seconds / 60) })}
                </p>
                <p className="txt-3 text-[11px]">{when}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
