import { create } from 'zustand'
import { setExtraJourneys } from '../lib/catalog'
import { STORAGE_KEYS, makeId, readJSON, writeJSON } from '../lib/storage'
import type { Journey } from '../lib/types'

/**
 * Journeys the person built for themselves.
 *
 * They are stored whole rather than as the answers that produced them. The
 * generator will change — that is the point of having one — and a week somebody
 * has been walking for four nights should not quietly become a different week
 * because the ramp for `flowing` was retuned. What is saved is the schedule.
 *
 * The list is pushed into the catalogue on load and on every change, so
 * `getJourney` finds a built journey exactly the way it finds a shipped one and
 * nothing downstream has to know the difference.
 */

type State = {
  journeys: Journey[]
  save: (journey: Omit<Journey, 'id'>) => string
  remove: (id: string) => void
}

const load = (): Journey[] => {
  const raw = readJSON<Journey[]>(STORAGE_KEYS.customJourneys, [])
  return Array.isArray(raw) ? raw.filter((j) => j?.id && Array.isArray(j.schedule)) : []
}

export const useCustomJourneys = create<State>((set, get) => {
  const initial = load()
  setExtraJourneys(initial)

  const persist = (journeys: Journey[]) => {
    set({ journeys })
    setExtraJourneys(journeys)
    writeJSON(STORAGE_KEYS.customJourneys, journeys)
  }

  return {
    journeys: initial,

    save: (journey) => {
      // `custom-` is load-bearing: it is how a built journey is told apart from
      // a shipped one without a second lookup.
      const id = `custom-${makeId()}`
      persist([{ ...journey, id }, ...get().journeys])
      return id
    },

    remove: (id) => persist(get().journeys.filter((j) => j.id !== id)),
  }
})
