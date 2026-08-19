import { create } from 'zustand'
import { STORAGE_KEYS, readJSON, writeJSON } from '../lib/storage'

/**
 * Journeys marked to come back to.
 *
 * Ids only, and deliberately so. A journey the person has starred is still the
 * catalogue's journey — it can be retuned, its copy corrected, a day's length
 * changed — and a favourite that carried its own copy of the schedule would
 * quietly freeze whichever version happened to be current the day it was
 * starred. Built journeys are the opposite case and are stored whole, for the
 * reason written at the top of `customJourneyStore`: those have no catalogue
 * entry to point back at.
 *
 * An id that no longer resolves is dropped at read time rather than at write
 * time, which is what keeps deleting a built journey from leaving a dead star
 * behind.
 */

type State = {
  ids: string[]
  has: (id: string) => boolean
  toggle: (id: string) => void
  remove: (id: string) => void
}

const load = (): string[] => {
  const raw = readJSON<string[]>(STORAGE_KEYS.favourites, [])
  return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : []
}

export const useFavourites = create<State>((set, get) => {
  const persist = (ids: string[]) => {
    set({ ids })
    writeJSON(STORAGE_KEYS.favourites, ids)
  }

  return {
    ids: load(),

    has: (id) => get().ids.includes(id),

    // Newest first, so the list reads as the order they were starred in.
    toggle: (id) => {
      const ids = get().ids
      persist(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids])
    },

    remove: (id) => persist(get().ids.filter((x) => x !== id)),
  }
})
