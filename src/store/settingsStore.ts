import { create } from 'zustand'
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '../lib/storage'
// Type-only: importing the i18n module for real would close a cycle, since it
// reads the language back out of this store.
import type { Lang } from '../lib/i18n'
import { mediaRoute } from '../audio/MediaRoute'

/**
 * `noir` is a third ground, not a brightness step: true black with the frost
 * removed and the accents raised. See the block in `index.css`.
 */
export const THEMES = ['dark', 'noir', 'light'] as const
export type Theme = (typeof THEMES)[number]

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
  /** Which artwork the television stage shows. Index into `FIGURES`. */
  figure: number
}

type SettingsState = Settings & {
  setLang: (lang: Lang) => void
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setReducedMotion: (v: boolean) => void
  setKeepScreenAwake: (v: boolean) => void
  setFigure: (index: number) => void
  dismissHeadphoneNotice: () => void
  resetAllData: () => void
}

const DEFAULTS: Settings = {
  theme: 'dark',
  lang: 'he',
  reducedMotion: false,
  headphoneNoticeSeen: false,
  keepScreenAwake: false,
  figure: 0,
}

function applyTheme(theme: Theme) {
  // The store is imported by pure-logic tests, which have no DOM.
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('theme-light', theme === 'light')
  root.classList.toggle('theme-noir', theme === 'noir')
  // `noir` is not a colour-scheme the browser knows; it is a dark one.
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark'
}

/** The page background behind the app, for the browser chrome. */
export const THEME_COLOR: Record<Theme, string> = {
  dark: '#05030e',
  noir: '#000000',
  light: '#f3f0fb',
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
      figure: get().figure,
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
      const order = THEMES
      const theme = order[(order.indexOf(get().theme) + 1) % order.length]
      applyTheme(theme)
      persist({ theme })
    },
    setReducedMotion: (v) => persist({ reducedMotion: v }),
    setKeepScreenAwake: (v) => {
      void mediaRoute.setWakeLock(v)
      persist({ keepScreenAwake: v })
    },
    setFigure: (index) => persist({ figure: index }),
    dismissHeadphoneNotice: () => persist({ headphoneNoticeSeen: true }),
    resetAllData: () => {
      for (const key of Object.values(STORAGE_KEYS)) removeKey(key)
      applyTheme(DEFAULTS.theme)
      applyLang(DEFAULTS.lang)
      set({ ...DEFAULTS })
    },
  }
})
