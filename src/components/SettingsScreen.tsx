import { useState } from 'react'
import { useSettings } from '../store/settingsStore'
import { usePresets } from '../store/presetsStore'
import { useJourneys } from '../store/journeyStore'
import { Card, Screen } from './ui'

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="flex w-full items-center gap-4 p-1 text-right"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="txt-3 mt-0.5 block text-[11px] leading-relaxed">{hint}</span>}
      </span>
      <span
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200"
        style={{
          background: checked ? 'hsl(var(--h) 92% 62%)' : 'var(--border)',
          boxShadow: checked ? '0 0 18px var(--glow)' : undefined,
        }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200"
          style={{ right: checked ? '0.25rem' : '1.75rem' }}
        />
      </span>
    </button>
  )
}

export function SettingsScreen() {
  const { theme, reducedMotion, setTheme, setReducedMotion, resetAllData } = useSettings()
  const clearPresets = usePresets((s) => s.clear)
  const clearJourneys = useJourneys((s) => s.clearAll)
  const [wiped, setWiped] = useState(false)

  const handleReset = () => {
    if (!confirm('לאפס את כל הנתונים המקומיים? פריסטים והתקדמות במסעות יימחקו לצמיתות.')) return
    clearPresets()
    clearJourneys()
    resetAllData()
    setWiped(true)
  }

  return (
    <Screen title="הגדרות" onBack>
      <div className="space-y-3">
        <Card>
          <Toggle
            label="מצב כהה"
            hint="ברירת המחדל. מצב בהיר מתאים לשימוש יומי בחוץ."
            checked={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
          />
        </Card>

        <Card>
          <Toggle
            label="הפחתת תנועה"
            hint="מרגיע את הוויזואליזציה ואת רקע האורורה — עדיף לפני שינה או ברגישות לתנועה."
            checked={reducedMotion}
            onChange={setReducedMotion}
          />
        </Card>

        <Card>
          <h3 className="text-sm font-bold">נתונים מקומיים</h3>
          <p className="txt-2 mt-1 text-[11px] leading-relaxed">
            לאפליקציה אין שרת, אין חשבון ואין סנכרון. הפריסטים, התקדמות המסעות וההגדרות שמורים
            ב-localStorage של הדפדפן הזה בלבד — ניקוי נתוני הדפדפן ימחק אותם.
          </p>
          <button onClick={handleReset} className="btn mt-3 w-full text-xs" style={{ color: '#ff8fa3' }}>
            איפוס כל הנתונים המקומיים
          </button>
          {wiped && <p className="chip mt-2">הנתונים נמחקו</p>}
        </Card>

        <Card>
          <h3 className="text-sm font-bold">על Resona</h3>
          <p className="txt-2 mt-1 text-[11px] leading-relaxed">
            המלודיה נוצרת בזמן אמת מסולם אינטונציה טהורה שבנוי סביב תדר היעד שנבחר — כל תו הוא מכפלה
            הרמונית של אותו תדר. אין קבצי מוזיקה, אין לופ, ולכן אין שתי האזנות זהות.
          </p>
          <p className="txt-3 mt-3 text-[11px] leading-relaxed">
            Resona הוא כלי להרפיה והאזנה. אינו מכשיר רפואי, אינו מאבחן ואינו מטפל, ואינו תחליף לייעוץ
            מקצועי. בעל אפילפסיה, רגישות לגירוי קצבי או מצב נוירולוגי — היוועץ ברופא לפני שימוש
            בשכבת הגלים המוחיים.
          </p>
        </Card>
      </div>
    </Screen>
  )
}
