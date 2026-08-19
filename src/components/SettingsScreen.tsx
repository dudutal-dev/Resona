import { useState } from 'react'
import { THEMES, THEME_COLOR, useSettings } from '../store/settingsStore'
import { usePresets } from '../store/presetsStore'
import { useJourneys } from '../store/journeyStore'
import { LANGS, LANG_LABEL, useT, type StringKey } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { ListeningMode } from './ListeningMode'
import { checkForUpdate, reloadNow, type UpdateState } from '../lib/updater'
import { Card, Screen } from './ui'

/** The build this screen is running — same stamp the About screen prints. */
const BUILD = __BUILD__

/**
 * "Check for updates", because an installed PWA is resumed far more often than
 * it is loaded, and a new build can sit on the server for a week without the
 * phone ever asking. See `lib/updater` for what the button actually does.
 */
function UpdateCard() {
  const { t } = useT()
  const [state, setState] = useState<UpdateState | 'idle' | 'checking'>('idle')

  const run = async () => {
    if (state === 'checking') return
    setState('checking')
    setState(await checkForUpdate())
    // On 'updated' the page is already reloading, so this component is about to
    // be replaced — the message is there for the moment before it goes.
  }

  const MESSAGE: Record<UpdateState, StringKey> = {
    updated: 'settings.updateFound',
    current: 'settings.updateCurrent',
    unmanaged: 'settings.updateUnmanaged',
    failed: 'settings.updateFailed',
  }
  const message = state === 'idle' || state === 'checking' ? null : MESSAGE[state]

  return (
    <Card>
      <p className="text-sm font-semibold">{t('settings.update')}</p>
      <p className="txt-3 mt-0.5 text-[11px] leading-relaxed">{t('settings.updateHint')}</p>
      <button onClick={run} disabled={state === 'checking'} className="btn mt-3 w-full text-xs">
        {t(state === 'checking' ? 'settings.updateChecking' : 'settings.updateCheck')}
      </button>
      {message && (
        <p className="chip mt-2" style={state === 'failed' ? { color: '#ff8fa3' } : undefined}>
          {t(message)}
        </p>
      )}
      {state === 'unmanaged' && (
        <button onClick={reloadNow} className="btn mt-2 w-full text-xs">
          {t('settings.updateReload')}
        </button>
      )}
      <p className="txt-3 mt-3 text-[10px]">
        {t('settings.updateBuild')} <span className="readout">{BUILD}</span>
      </p>
    </Card>
  )
}

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
                    background: active ? 'var(--gold-soft)' : 'var(--obj)',
                    border: `1px solid ${active ? 'var(--gold)' : 'var(--obj-line)'}`,
                    color: active ? 'var(--gold)' : 'var(--txt-2)',
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
          <p className="text-sm font-semibold">{t('settings.theme')}</p>
          <p className="txt-3 mt-0.5 text-[11px] leading-relaxed">{t('settings.themeHint')}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {THEMES.map((name) => {
              const active = theme === name
              return (
                <button
                  key={name}
                  onClick={() => setTheme(name)}
                  aria-pressed={active}
                  className="rounded-2xl px-2 py-3 text-xs font-semibold transition-all active:scale-95"
                  style={{
                    background: active ? 'var(--gold-soft)' : 'var(--obj)',
                    border: `1px solid ${active ? 'var(--gold)' : 'var(--obj-line)'}`,
                    color: active ? 'var(--gold)' : 'var(--txt-2)',
                  }}
                >
                  {/* A swatch of the actual ground, so the choice is visible
                      rather than only named. */}
                  <span
                    className="mx-auto mb-2 block h-7 w-7 rounded-full"
                    style={{
                      background: THEME_COLOR[name],
                      border: `1px solid ${active ? 'var(--gold)' : 'var(--border-strong)'}`,
                      boxShadow: active ? '0 0 16px var(--glow)' : undefined,
                    }}
                  />
                  {t(`settings.theme.${name}` as StringKey)}
                </button>
              )
            })}
          </div>
        </Card>

        <Card>
          <Toggle
            label={t('settings.reducedMotion')}
            hint={t('settings.reducedMotionHint')}
            checked={reducedMotion}
            onChange={setReducedMotion}
          />
        </Card>

        <UpdateCard />

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
