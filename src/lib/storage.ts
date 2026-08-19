/** Thin, failure-tolerant localStorage wrapper (private mode, quota, bad JSON). */

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* nothing we can do */
  }
}

export const STORAGE_KEYS = {
  presets: 'presets',
  journeyProgress: 'journeyProgress',
  settings: 'settings',
  lastSession: 'lastSession',
  history: 'history',
  customJourneys: 'customJourneys',
  favourites: 'favourites',
} as const

/** crypto.randomUUID is unavailable on http origins in some browsers. */
export function makeId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
