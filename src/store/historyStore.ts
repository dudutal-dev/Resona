import { create } from 'zustand'
import { STORAGE_KEYS, readJSON, writeJSON } from '../lib/storage'

/**
 * What was actually listened to.
 *
 * Journeys already record their own progress, but a free session left no trace
 * at all — play for forty minutes and the app forgets it happened. Over a month
 * that record is the most personal thing here: which frequencies you keep
 * returning to, and for how long. It is also the cheapest feature in the app,
 * being twenty rows of JSON.
 *
 * Only sessions that ran long enough to have been listened to are kept. Starting
 * something, hearing three seconds of it and pressing stop is not a session, and
 * a history full of those is worse than no history.
 */
export type Listen = {
  id: string
  /** Epoch millis at the moment the session ended. */
  at: number
  rootId: string
  beatId: string | null
  beatHz: number
  seconds: number
  /** Set when the session was a guided day rather than a free listen. */
  journeyId?: string
  day?: number
}

/** Below this a session is a mis-tap, not a listen. */
export const MIN_LISTEN_SECONDS = 60
/** Enough to see a pattern, few enough to stay a list rather than an archive. */
const KEEP = 40

type HistoryState = {
  listens: Listen[]
  /** Ignores anything shorter than `MIN_LISTEN_SECONDS`; returns whether it kept it. */
  record: (listen: Omit<Listen, 'id' | 'at'>) => boolean
  clear: () => void
}

export const useHistory = create<HistoryState>((set, get) => ({
  listens: readJSON<Listen[]>(STORAGE_KEYS.history, []),

  record: (listen) => {
    if (!(listen.seconds >= MIN_LISTEN_SECONDS)) return false
    const entry: Listen = {
      ...listen,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: Date.now(),
    }
    const listens = [entry, ...get().listens].slice(0, KEEP)
    set({ listens })
    writeJSON(STORAGE_KEYS.history, listens)
    return true
  },

  clear: () => {
    set({ listens: [] })
    writeJSON(STORAGE_KEYS.history, [])
  },
}))
