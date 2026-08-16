import { create } from 'zustand'
import type { AmbienceId, BeatMode, MelodyStyle, SessionConfig, TimerMode } from '../lib/types'
import { defaultBeatHz, getFrequency } from '../lib/catalog'
import { STORAGE_KEYS, readJSON, writeJSON } from '../lib/storage'
import { player } from '../audio/SessionPlayer'

export const DEFAULT_CONFIG: SessionConfig = {
  rootId: 'sol-528',
  beatId: 'bb-theta',
  beatHz: 6,
  beatMode: 'isochronic',
  ambience: 'rain',
  levels: { melody: 0.75, beat: 0.3, ambience: 0.35, master: 0.85 },
  timerMode: '30',
  density: 0.5,
  pace: 0.25,
  depth: 0,
  style: 'ambient',
}

type SessionState = {
  config: SessionConfig
  isPlaying: boolean
  /** Set while the closing fade runs, so the UI can dim in step with the audio. */
  isFading: boolean
  elapsed: number
  remaining: number | null
  /** Journey day currently being played, if this session was launched from one. */
  activeJourney: { journeyId: string; day: number } | null

  setRoot: (id: string) => void
  setBeat: (id: string | null) => void
  setBeatHz: (hz: number) => void
  setBeatMode: (mode: BeatMode) => void
  setAmbience: (id: AmbienceId) => void
  setLevel: (layer: keyof SessionConfig['levels'], value: number) => void
  setTimerMode: (mode: TimerMode) => void
  setDensity: (value: number) => void
  setPace: (value: number) => void
  setDepth: (value: number) => void
  setStyle: (style: MelodyStyle) => void
  loadConfig: (config: SessionConfig, journey?: { journeyId: string; day: number } | null) => void

  toggle: () => Promise<void>
  stop: () => Promise<void>
  tick: () => void
}

function persist(config: SessionConfig) {
  writeJSON(STORAGE_KEYS.lastSession, config)
}

function restore(): SessionConfig {
  const saved = readJSON<Partial<SessionConfig> | null>(STORAGE_KEYS.lastSession, null)
  if (!saved || typeof saved !== 'object') return DEFAULT_CONFIG
  return {
    ...DEFAULT_CONFIG,
    ...saved,
    levels: { ...DEFAULT_CONFIG.levels, ...(saved.levels ?? {}) },
  }
}

export const useSession = create<SessionState>((set, get) => {
  /** Writes the config through to the running audio graph and to storage. */
  const commit = (config: SessionConfig) => {
    set({ config })
    persist(config)
    player.applyConfig(config)
  }

  return {
    config: restore(),
    isPlaying: false,
    isFading: false,
    elapsed: 0,
    remaining: null,
    activeJourney: null,

    setRoot: (id) => commit({ ...get().config, rootId: id }),

    setBeat: (id) => {
      const config = get().config
      if (!id) return commit({ ...config, beatId: null })
      const f = getFrequency(id)
      const hz = f ? defaultBeatHz(f) : config.beatHz
      commit({ ...config, beatId: id, beatHz: hz })
    },

    // Two decimals, not one: 7.83 is a specific number people come for.
    setBeatHz: (hz) => commit({ ...get().config, beatHz: Math.round(hz * 100) / 100 }),
    setBeatMode: (mode) => commit({ ...get().config, beatMode: mode }),
    setAmbience: (id) => commit({ ...get().config, ambience: id }),

    setLevel: (layer, value) => {
      const config = get().config
      commit({ ...config, levels: { ...config.levels, [layer]: value } })
    },

    setTimerMode: (mode) => commit({ ...get().config, timerMode: mode }),
    setDensity: (value) => commit({ ...get().config, density: value }),
    setPace: (value) => commit({ ...get().config, pace: value }),
    setDepth: (value) => commit({ ...get().config, depth: value }),
    setStyle: (style) => commit({ ...get().config, style }),

    loadConfig: (config, journey = null) => {
      set({ activeJourney: journey })
      // Before the commit, so the first metadata published already names the day.
      player.setJourneyContext(journey)
      commit(config)
    },

    toggle: async () => {
      await player.toggle(get().config)
      set({ isPlaying: player.isPlaying })
    },

    stop: async () => {
      await player.stop()
      player.setJourneyContext(null)
      set({ isPlaying: player.isPlaying, activeJourney: null })
    },

    tick: () => {
      set({
        isPlaying: player.isPlaying,
        isFading: player.isFadingOut(),
        elapsed: player.getElapsedSeconds(),
        remaining: player.getRemainingSeconds(),
      })
    },
  }
})

// Keep the store honest when the player ends a session on its own (timer).
player.onChange(() => useSession.getState().tick())
