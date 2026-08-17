import { useState } from 'react'
import { useSettings } from '../store/settingsStore'
import { usePresets } from '../store/presetsStore'
import { useJourneys } from '../store/journeyStore'
import { LANGS, LANG_LABEL, useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { ListeningMode } from './ListeningMode'
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
      className="flex w-full items-center gap-4 p-1 text-start"
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
  const { t } = useT()
  const { theme, lang, reducedMotion, setTheme, setLang, setReducedMotion, resetAllData } =
    useSettings()
  const beatId = useSession((s) => s.config.beatId)
  const clearPresets = usePresets((s) => s.clear)
  const clearJourneys = useJourneys((s) => s.clearAll)
  const [wiped, setWiped] = useState(false)

  const handleReset = () => {
    if (!confirm(t('settings.resetConfirm'))) return
    clearPresets()
    clearJourneys()
    resetAllData()
    setWiped(true)
  }

  return (
    <Screen title={t('settings.title')} onBack>
      <div className="space-y-3">
        {/* First, because everything below it is written in whatever this picks. */}
        <Card>
          <p className="text-sm font-semibold">{t('settings.language')}</p>
          <p className="txt-3 mt-0.5 text-[11px] leading-relaxed">{t('settings.languageHint')}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {LANGS.map((code) => {
              const active = lang === code
              return (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  aria-pressed={active}
                  lang={code}
                  dir={code === 'he' ? 'rtl' : 'ltr'}
                  className="rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-95"
                  style={{
                    background: active ? 'var(--accent-soft)' : 'var(--card)',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    color: active ? 'var(--accent)' : 'var(--txt-2)',
                  }}
                >
                  {LANG_LABEL[code]}
                </button>
              )
            })}
          </div>
        </Card>
        {/* The opening sheet asks this once; this is where it can be changed later. */}
        <Card>
          <ListeningMode compact hasBeatLayer={!!beatId} />
        </Card>

        <Card>
          <Toggle
            label={t('settings.dark')}
            hint={t('settings.darkHint')}
            checked={theme === 'dark'}
            onChange={(v) => setTheme(v ? 'dark' : 'light')}
          />
        </Card>

        <Card>
          <Toggle
            label={t('settings.reducedMotion')}
            hint={t('settings.reducedMotionHint')}
            checked={reducedMotion}
            onChange={setReducedMotion}
          />
        </Card>

        <Card>
          <h3 className="text-sm font-bold">{t('settings.localData')}</h3>
          <p className="txt-2 mt-1 text-[11px] leading-relaxed">
            {t('settings.localDataBody')}
          </p>
          <button onClick={handleReset} className="btn mt-3 w-full text-xs" style={{ color: '#ff8fa3' }}>
            {t('settings.resetAll')}
          </button>
          {wiped && <p className="chip mt-2">{t('settings.wiped')}</p>}
        </Card>

        <Card onClick={() => navigate('/about')}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold">{t('settings.about')}</h3>
              <p className="txt-3 mt-0.5 text-[11px]">
                {t('settings.aboutHint')}
              </p>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="flip-ltr txt-3 shrink-0">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Card>
      </div>
    </Screen>
  )
}
