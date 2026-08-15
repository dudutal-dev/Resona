import { TRUST_NOTICE } from '../lib/catalog'
import type { Frequency } from '../lib/types'
import { Sheet, TrustBadge } from './ui'

/**
 * The transparency layer (§6.6). Every claim in the app is reachable from here,
 * paired with the honest statement of how well it is supported — the app is
 * explicitly not in the business of implying clinical effect.
 */
export function InfoPanel({
  freq,
  open,
  onClose,
}: {
  freq: Frequency | null
  open: boolean
  onClose: () => void
}) {
  if (!freq) return null
  const hzText = freq.hz ? `${freq.hz} Hz` : `${freq.range?.[0]}–${freq.range?.[1]} Hz`

  return (
    <Sheet open={open} onClose={onClose} title={freq.label}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-sm font-bold"
            style={{
              background: `hsl(${freq.hue} 85% 62% / 0.16)`,
              border: `1px solid hsl(${freq.hue} 85% 65% / 0.45)`,
              color: `hsl(${freq.hue} 90% 72%)`,
              boxShadow: `0 0 30px hsl(${freq.hue} 90% 60% / 0.35)`,
            }}
          >
            <span className="ltr">{freq.hz ?? freq.range?.[0]}</span>
          </div>
          <div className="min-w-0">
            <p className="ltr text-sm font-semibold">{hzText}</p>
            <p className="txt-3 mt-0.5 text-xs">
              {freq.type === 'solfeggio'
                ? 'סולם סולפג׳יו מסורתי'
                : freq.type === 'tuning'
                  ? 'כוונון מוזיקלי'
                  : 'טווח גלי מוח'}
            </p>
          </div>
        </div>

        <div>
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider txt-3">מה מיוחס לתדר</h3>
          <p className="txt-2 text-sm leading-relaxed">{freq.info}</p>
        </div>

        <div
          className="rounded-2xl p-4"
          style={{
            background:
              freq.trust === 'traditional' ? 'rgba(255,209,102,0.08)' : 'rgba(77,232,255,0.08)',
            border: `1px solid ${
              freq.trust === 'traditional' ? 'rgba(255,209,102,0.25)' : 'rgba(77,232,255,0.25)'
            }`,
          }}
        >
          <TrustBadge trust={freq.trust} />
          <p className="mt-2 text-sm font-medium leading-relaxed">{TRUST_NOTICE[freq.trust]}</p>
        </div>

        {freq.hz && (
          <div>
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider txt-3">
              איך התדר נשמע כאן
            </h3>
            <p className="txt-2 text-sm leading-relaxed">
              התדר אינו מונח ברקע כטון נפרד. הוא משמש כתדר היסוד של הסולם — כל תו במלודיה הוא מכפלה
              של <span className="ltr font-semibold">{freq.hz} Hz</span> ביחס הרמוני טהור (כמו{' '}
              <span className="ltr">3/2</span> או <span className="ltr">5/4</span>), כך שהמוזיקה עצמה
              בנויה מהתדר ולא רק לצידו.
            </p>
          </div>
        )}

        <p className="txt-3 border-t pt-4 text-[11px] leading-relaxed" style={{ borderColor: 'var(--border)' }}>
          Resona הוא כלי להרפיה והאזנה. אינו מכשיר רפואי, אינו מאבחן ואינו מטפל במצב בריאותי כלשהו,
          ואינו תחליף לייעוץ מקצועי. אם יש לך אפילפסיה, רגישות לגירוי קצבי, או מצב נוירולוגי — היוועץ
          ברופא לפני שימוש בשכבת הגלים המוחיים.
        </p>
      </div>
    </Sheet>
  )
}
