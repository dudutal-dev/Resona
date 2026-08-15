import { create } from 'zustand'
import type { JourneyProgress, MoodScore } from '../lib/types'
import { STORAGE_KEYS, readJSON, writeJSON } from '../lib/storage'
import { getJourney } from '../lib/catalog'

type JourneyState = {
  progress: Record<string, JourneyProgress>
  start: (journeyId: string) => void
  completeDay: (journeyId: string, day: number, mood?: MoodScore) => void
  setMood: (journeyId: string, day: number, mood: MoodScore) => void
  goToDay: (journeyId: string, day: number) => void
  reset: (journeyId: string) => void
  clearAll: () => void
}

function load(): Record<string, JourneyProgress> {
  const raw = readJSON<Record<string, JourneyProgress> | JourneyProgress[]>(
    STORAGE_KEYS.journeyProgress,
    {},
  )
  // Tolerate the array shape written by earlier builds.
  if (Array.isArray(raw)) {
    return Object.fromEntries(raw.filter((p) => p?.journeyId).map((p) => [p.journeyId, p]))
  }
  return raw && typeof raw === 'object' ? raw : {}
}

export const useJourneys = create<JourneyState>((set, get) => {
  const persist = (progress: Record<string, JourneyProgress>) => {
    set({ progress })
    writeJSON(STORAGE_KEYS.journeyProgress, progress)
  }

  return {
    progress: load(),

    start: (journeyId) => {
      if (get().progress[journeyId]) return
      persist({
        ...get().progress,
        [journeyId]: {
          journeyId,
          currentDay: 1,
          completedDays: [],
          startedAt: new Date().toISOString(),
          dailyMood: {},
        },
      })
    },

    completeDay: (journeyId, day, mood) => {
      const journey = getJourney(journeyId)
      const existing = get().progress[journeyId] ?? {
        journeyId,
        currentDay: day,
        completedDays: [],
        startedAt: new Date().toISOString(),
        dailyMood: {},
      }
      const completedDays = existing.completedDays.includes(day)
        ? existing.completedDays
        : [...existing.completedDays, day].sort((a, b) => a - b)
      const lastDay = journey?.days ?? day
      persist({
        ...get().progress,
        [journeyId]: {
          ...existing,
          completedDays,
          // Advance to the next day, but never past the end of the journey.
          currentDay: Math.min(lastDay, Math.max(existing.currentDay, day + 1)),
          dailyMood: mood ? { ...(existing.dailyMood ?? {}), [day]: mood } : existing.dailyMood,
        },
      })
    },

    setMood: (journeyId, day, mood) => {
      const existing = get().progress[journeyId]
      if (!existing) return
      persist({
        ...get().progress,
        [journeyId]: { ...existing, dailyMood: { ...(existing.dailyMood ?? {}), [day]: mood } },
      })
    },

    goToDay: (journeyId, day) => {
      const existing = get().progress[journeyId]
      if (!existing) return
      persist({ ...get().progress, [journeyId]: { ...existing, currentDay: day } })
    },

    reset: (journeyId) => {
      const next = { ...get().progress }
      delete next[journeyId]
      persist(next)
    },

    clearAll: () => persist({}),
  }
})

/** True when every day in the journey has been marked complete. */
export function isJourneyComplete(progress: JourneyProgress | undefined, totalDays: number) {
  return !!progress && progress.completedDays.length >= totalDays
}
