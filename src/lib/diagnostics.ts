/**
 * A local flight recorder.
 *
 * The audio faults that actually happen here — the context interrupted by a
 * call, a resume that needs a gesture, a route to a stereo that stops carrying
 * sound — cannot be reproduced in a headless browser, and the person holding
 * the phone can only report "the music stopped". So the app writes down what it
 * did, and the log can be handed over afterwards.
 *
 * Two constraints shaped this. It has to **survive a reload**, because reloading
 * is one of the things that happens after a fault, so it lives in localStorage
 * rather than in memory. And it has to **stay on the device**: the app has no
 * server and is not getting one for this. Nothing is sent anywhere; the log is
 * read on the Settings screen and shared only if the person chooses to share it.
 *
 * Kept to short tags rather than free prose so a hundred entries are still
 * legible, and capped so it can never grow without bound.
 */

import { STORAGE_KEYS, readJSON, writeJSON } from './storage'

/** Entries beyond this are dropped oldest-first. */
const MAX_ENTRIES = 140

export type DiagEntry = {
  /** Epoch milliseconds. Absolute, because the useful question is "when". */
  t: number
  /** A short, stable tag — see the call sites. */
  tag: string
  /** Optional specifics: a state name, an error message, a count. */
  detail?: string
  /** How many times in a row this same entry occurred; absent means once. */
  repeat?: number
}

let entries: DiagEntry[] = readJSON<DiagEntry[]>(STORAGE_KEYS.diagnostics, [])
const listeners = new Set<() => void>()

function persist() {
  writeJSON(STORAGE_KEYS.diagnostics, entries)
  for (const fn of listeners) fn()
}

/**
 * Record something worth knowing later.
 *
 * Deliberately cheap and deliberately silent: a logger that can throw, or that
 * costs anything on the audio path, would be worse than no logger at all.
 */
export function diag(tag: string, detail?: string) {
  const entry: DiagEntry = { t: Date.now(), tag }
  if (detail) entry.detail = detail.slice(0, 160)
  // A fault often repeats — a stalled route retrying every second would push
  // everything else out of a 140-entry log within three minutes. Identical
  // consecutive tags are counted instead of appended.
  const last = entries[entries.length - 1]
  if (last && last.tag === tag && last.detail === entry.detail && entry.t - last.t < 60_000) {
    last.t = entry.t
    last.repeat = (last.repeat ?? 1) + 1
  } else {
    entries.push(entry)
    if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  }
  persist()
}

export function readDiagnostics(): DiagEntry[] {
  return entries
}

export function clearDiagnostics() {
  entries = []
  persist()
}

export function watchDiagnostics(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * The log as one block of text, with the few facts that make it readable by
 * someone who was not there: which build, which browser, when.
 *
 * The user agent is in here because "it stops when I switch apps" means
 * different things on iOS and on Android, and it is the one line that decides
 * which. It is device information, not personal information, and it never
 * leaves the phone unless the person sends it.
 */
export function diagnosticsReport(build: string): string {
  const head = [
    `Resona ${build}`,
    typeof navigator === 'undefined' ? '' : navigator.userAgent,
    `${entries.length} entries · exported ${new Date().toISOString()}`,
    '',
  ]
  const body = entries.map((e) => {
    const time = new Date(e.t).toISOString().slice(11, 19)
    const times = e.repeat && e.repeat > 1 ? ` ×${e.repeat}` : ''
    return `${time} ${e.tag}${times}${e.detail ? ` — ${e.detail}` : ''}`
  })
  return [...head, ...body].join('\n')
}

/**
 * Errors nobody caught.
 *
 * Installed once from the entry point. Without this the log records what the
 * app meant to do and not the thing that actually broke.
 */
export function watchUncaught() {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (e) => {
    diag('error', `${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string } | string | undefined
    diag('rejection', typeof reason === 'string' ? reason : reason?.message || 'unknown')
  })
}
