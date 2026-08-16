import { create } from 'zustand'
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '../lib/storage'
import { mediaRoute } from '../audio/MediaRoute'

export type Theme = 'dark' | 'light'

type Settings = {
  theme: Theme
  /** Reduces the visualiser to a calm glow — helpful before sleep. */
  reducedMotion: boolean
  /** Dismissed once the headphone note has been acknowledged. */
  headphoneNoticeSeen: boolean
  /** Holds a screen wake lock while a session plays. */
  keepScreenAwake: boolean
}

type SettingsState = Settings & {
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setReducedMotion: (v: boolean) => void
  setKeepScreenAwake: (v: boolean) => void
  dismissHeadphoneNotice: () => void
  resetAllData: () => void
}

const DEFAULTS: Settings = {
  theme: 'dark',
  reducedMotion: false,
  headphoneNoticeSeen: false,
  keepScreenAwake: false,
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('theme-light', theme === 'light')
  root.style.colorScheme = theme
}

export const useSettings = create<SettingsState>((set, get) => {
  const saved = { ...DEFAULTS, ...readJSON<Partial<Settings>>(STORAGE_KEYS.settings, {}) }
  applyTheme(saved.theme)

  const persist = (next: Partial<Settings>) => {
    const merged = {
      theme: get().theme,
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
      applyTheme('dark')
      set({ ...DEFAULTS })
    },
  }
})
