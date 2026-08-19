import { useState } from 'react'
import { renderRich, useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { arrivedShared, isInstalled, shareTarget, type Shareable } from '../lib/share'
import { Card } from './ui'

/**
 * Sends this journey or this frequency to somebody.
 *
 * Sits next to the heart on a release header and behaves the same way: it stops
 * the press from reaching the card underneath, because both of these live on
 * things that navigate.
 */
export function ShareButton({ target, size = 20 }: { target: Shareable; size?: number }) {
  const { t, lang } = useT()
  const [note, setNote] = useState<string | null>(null)

  const go = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const outcome = await shareTarget(target, lang)
    // Only the outcomes the person cannot see for themselves are announced. A
    // share sheet that opened, or WhatsApp in a new tab, is its own feedback;
    // a silent copy to the clipboard is not.
    if (outcome === 'copied') setNote(t('share.copied'))
    else if (outcome === 'failed') setNote(null)
    if (outcome === 'copied') setTimeout(() => setNote(null), 2500)
  }

  return (
    <span className="relative inline-flex">
      <button
        onClick={go}
        aria-label={t('share.action')}
        title={t('share.action')}
        className="grid shrink-0 place-items-center rounded-full transition-transform active:scale-90"
        // Bare, like the heart beside it: two icons in one corner have to read
        // as a pair, and the boxed version made the share button look like the
        // primary action on a screen whose primary action is "start".
        style={{ height: size * 1.7, width: size * 1.7, color: 'var(--txt-3)' }}
      >
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {note && (
        <span
          className="chip absolute -bottom-7 end-0 whitespace-nowrap text-[10px]"
          role="status"
        >
          {note}
        </span>
      )}
    </span>
  )
}

/**
 * What the person on the other end of the message sees.
 *
 * Shown only when the screen was opened from a shared link and the app is not
 * already installed — so it never appears for the person who sent it, and never
 * again once the receiver has added it. It explains the one thing a web app
 * cannot do for itself: iOS has no install prompt to trigger, so the two-step
 * gesture has to be written out.
 */
export function SharedInvite() {
  const { t } = useT()
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || !arrivedShared() || isInstalled()) return null
  return (
    <Card glow className="mb-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold" style={{ color: 'var(--gold)' }}>
            {t('shared.title')}
          </h3>
          <p className="txt-2 mt-1 text-[11.5px] leading-relaxed">{renderRich(t('shared.body'))}</p>
          <button onClick={() => navigate('/about')} className="btn mt-3 text-[11px]">
            {t('shared.what')}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label={t('common.close')}
          className="txt-3 shrink-0 p-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </Card>
  )
}
