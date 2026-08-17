import { create } from 'zustand'
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '../lib/storage'
// Type-only: importing the i18n module for real would close a cycle, since it
// reads the language back out of this store.
import type { Lang } from '../lib/i18n'
import { mediaRoute } from '../audio/MediaRoute'

export type Theme = 'dark' | 'light'

type Settings = {
  theme: Theme
  /** Interface language. Also flips the document direction. */
  lang: Lang
  /** Reduces the visualiser to a calm glow — helpful before sleep. */
  reducedMotion: boolean
  /** Dismissed once the headphone note has been acknowledged. */
  headphoneNoticeSeen: boolean
  /** Holds a screen wake lock while a session plays. */
  keepScreenAwake: boolean
}

type SettingsState = Settings & {
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setReducedMotion: (v: boolean) => void
  setKeepScreenAwake: (v: boolean) => void
  dismissHeadphoneNotice: () => void
  resetAllData: () => void
}

const DEFAULTS: Settings = {
  theme: 'dark',
  lang: 'he',
  reducedMotion: false,
  headphoneNoticeSeen: false,
  keepScreenAwake: false,
}

function applyTheme(theme: Theme) {
  // The store is imported by pure-logic tests, which have no DOM.
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('theme-light', theme === 'light')
  root.style.colorScheme = theme
}

/**
 * Direction is a document-level property, not a React one: the scrollbar, text
 * selection and the browser's own bidi handling all read it from <html>.
 */
function applyLang(lang: Lang) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.lang = lang
  root.dir = lang === 'he' ? 'rtl' : 'ltr'
}

export const useSettings = create<SettingsState>((set, get) => {
  const saved = { ...DEFAULTS, ...readJSON<Partial<Settings>>(STORAGE_KEYS.settings, {}) }
  applyTheme(saved.theme)
  applyLang(saved.lang)

  const persist = (next: Partial<Settings>) => {
    const merged = {
      theme: get().theme,
      lang: get().lang,
      reducedMotion: get().reducedMotion,
      headphoneNoticeSeen: get().headphoneNoticeSeen,
      keepScreenAwake: get().keepScreenAwake,
      ...next,
    }
    set(next)
    writeJSON(STORAGE_KEYS.settings, merged)
  }

  return {
    ...saved,
    setLang: (lang) => {
      applyLang(lang)
      persist({ lang })
    },
    setTheme: (theme) => {
      applyTheme(theme)
      persist({ theme })
    },
    toggleTheme: () => {
      const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(theme)
      persist({ theme })
    },
    setReducedMotion: (v) => persist({ reducedMotion: v }),
    setKeepScreenAwake: (v) => {
      void mediaRoute.setWakeLock(v)
      persist({ keepScreenAwake: v })
    },
    dismissHeadphoneNotice: () => persist({ headphoneNoticeSeen: true }),
    resetAllData: () => {
      for (const key of Object.values(STORAGE_KEYS)) removeKey(key)
      applyTheme(DEFAULTS.theme)
      applyLang(DEFAULTS.lang)
      set({ ...DEFAULTS })
    },
  }
})
