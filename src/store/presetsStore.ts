import { create } from 'zustand'
import type { Preset, SessionConfig } from '../lib/types'
import { STORAGE_KEYS, makeId, readJSON, writeJSON } from '../lib/storage'

type PresetsState = {
  presets: Preset[]
  save: (name: string, config: SessionConfig) => Preset
  rename: (id: string, name: string) => void
  update: (id: string, config: SessionConfig) => void
  remove: (id: string) => void
  clear: () => void
}

function load(): Preset[] {
  const raw = readJSON<Preset[]>(STORAGE_KEYS.presets, [])
  return Array.isArray(raw) ? raw.filter((p) => p && p.id && p.config) : []
}

/**
 * `layers` mirrors the schema in the build spec; `config` carries the complete
 * state so a preset reloads exactly, including beat rate, mode and density.
 */
function toLayers(config: SessionConfig): Preset['layers'] {
  const layers = [{ frequencyId: config.rootId, volume: config.levels.melody }]
  if (config.beatId) layers.push({ frequencyId: config.beatId, volume: config.levels.beat })
  return layers
}

export const usePresets = create<PresetsState>((set, get) => ({
  presets: load(),

  save: (name, config) => {
    const preset: Preset = {
      id: makeId(),
      name: name.trim() || 'פריסט ללא שם',
      layers: toLayers(config),
      ambienceTrack: config.ambience === 'none' ? undefined : String(config.ambience),
      timerMode: config.timerMode,
      createdAt: new Date().toISOString(),
      config,
    }
    const next = [preset, ...get().presets]
    set({ presets: next })
    writeJSON(STORAGE_KEYS.presets, next)
    return preset
  },

  rename: (id, name) => {
    const next = get().presets.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
    set({ presets: next })
    writeJSON(STORAGE_KEYS.presets, next)
  },

  update: (id, config) => {
    const next = get().presets.map((p) =>
      p.id === id
        ? {
            ...p,
            config,
            layers: toLayers(config),
            timerMode: config.timerMode,
            ambienceTrack: config.ambience === 'none' ? undefined : String(config.ambience),
          }
        : p,
    )
    set({ presets: next })
    writeJSON(STORAGE_KEYS.presets, next)
  },

  remove: (id) => {
    const next = get().presets.filter((p) => p.id !== id)
    set({ presets: next })
    writeJSON(STORAGE_KEYS.presets, next)
  },

  clear: () => {
    set({ presets: [] })
    writeJSON(STORAGE_KEYS.presets, [])
  },
}))
