import { useSettings } from '../store/settingsStore'
import { useSession } from '../store/sessionStore'
import { Sheet } from './ui'

/**
 * Shown once, before the first session.
 *
 * Browsers cannot detect whether headphones are connected — there is no such
 * web API — so the app does the honest thing instead of guessing: it defaults
 * to the speaker-safe isochronic mode and explains when headphones actually
 * matter, letting the listener make the call.
 */
export function HeadphoneNotice() {
  const { headphoneNoticeSeen, dismissHeadphoneNotice } = useSettings()
  const setBeatMode = useSession((s) => s.setBeatMode)

  return (
    <Sheet
      open={!headphoneNoticeSeen}
      onClose={dismissHeadphoneNotice}
      title="לפני שמתחילים"
    >
      <div className="space-y-4">
        <p className="txt-2 text-sm leading-relaxed">
          שכבת הגלים המוחיים יכולה לפעול בשני אופנים:
        </p>

        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-bold">איזוכרוני — ברירת המחדל</p>
          <p className="txt-2 mt-1 text-[12px] leading-relaxed">
            צליל בודד שנפעם בקצב הנבחר. עובד ברמקולים, באוזניות, בכל דבר.
          </p>
        </div>

        <div className="glass rounded-2xl p-4">
          <p className="text-sm font-bold">ביינאורל — מחייב אוזניות</p>
          <p className="txt-2 mt-1 text-[12px] leading-relaxed">
            כל אוזן מקבלת תדר מעט שונה, והמוח משלים את ההפרש. ברמקולים שני הצלילים מתערבבים באוויר
            והאפקט פשוט לא נוצר — לכן זו אינה ברירת המחדל.
          </p>
        </div>

        <p className="txt-3 text-[11px] leading-relaxed">
          הדפדפן אינו יכול לזהות אם חיברת אוזניות, ולכן הבחירה נשארת אצלך. אפשר להחליף בכל רגע
          במיקסר. אם יש לך אפילפסיה או רגישות לגירוי קצבי — היוועץ ברופא לפני שימוש בשכבה הזו.
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setBeatMode('binaural')
              dismissHeadphoneNotice()
            }}
            className="btn flex-1 text-xs"
          >
            יש לי אוזניות — ביינאורל
          </button>
          <button
            onClick={() => {
              setBeatMode('isochronic')
              dismissHeadphoneNotice()
            }}
            className="btn btn-primary flex-1 text-xs"
          >
            המשך באיזוכרוני
          </button>
        </div>
      </div>
    </Sheet>
  )
}
