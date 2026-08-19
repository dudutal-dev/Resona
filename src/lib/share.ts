/**
 * Sending a journey or a frequency to somebody, and having it open where it
 * should when they tap it.
 *
 * The link is the app's own URL with a hash on the end, because that is what
 * hash routing gives for free: `#/journey/aurora-6` is already a working
 * address for that screen, in the browser and inside an installed copy alike.
 * Nothing has to be generated, hosted or resolved.
 *
 * `?s=1` rides along so the receiving screen can tell it was arrived at from a
 * shared message rather than from the app's own navigation — see `arrivedShared`.
 * The router ignores everything after the `?`, so it costs nothing.
 */

import { freqLabel, getFrequency, getJourney, journeyTitle } from './catalog'
import { translate, type Lang } from './i18n'

/** The app's address, whatever host it happens to be served from. */
function appUrl(): string {
  const { origin, pathname } = window.location
  return `${origin}${pathname}`
}

export type Shareable =
  | { kind: 'journey'; id: string }
  | { kind: 'frequency'; id: string }

export function shareLink(target: Shareable): string {
  const path = target.kind === 'journey' ? `/journey/${target.id}` : `/player/${target.id}`
  return `${appUrl()}#${path}?s=1`
}

/**
 * What the message says.
 *
 * Written as a person would write it — the name of the thing, one line of what
 * it is, then the link — because it is going into a chat, not into a feed. No
 * hashtags, no exclamation, nothing that reads as an advert forwarded by a
 * friend.
 */
export function shareMessage(target: Shareable, lang: Lang): string {
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string>) =>
    translate(lang, key, vars)
  const link = shareLink(target)
  // The invitation first, the link, then the ask — in that order, and the ask
  // last on purpose. A message that opens by asking for bug reports tells the
  // person to evaluate before they have heard anything, and what is worth
  // knowing first is whether they listen at all.
  const opening =
    target.kind === 'journey'
      ? (() => {
          const journey = getJourney(target.id)
          return journey
            ? t('share.journeyLine', { title: journeyTitle(journey, lang), n: String(journey.days) })
            : ''
        })()
      : (() => {
          const freq = getFrequency(target.id)
          return freq ? t('share.freqLine', { name: freqLabel(freq, lang), hz: String(freq.hz) }) : ''
        })()
  if (!opening) return link
  return `${opening}\n${link}\n\n${t('share.ask')}`
}

export type ShareOutcome = 'shared' | 'whatsapp' | 'copied' | 'failed'

/**
 * Hands the message to the phone, and falls back rather than failing.
 *
 * The share sheet is the right answer where it exists: it is one tap to
 * WhatsApp and it is what people already know. Where it does not exist — a
 * desktop browser, mostly — WhatsApp's own link does the same job with a
 * contact picker. The clipboard is the last resort, and it still leaves the
 * person holding exactly what they were trying to send.
 */
export async function shareTarget(target: Shareable, lang: Lang): Promise<ShareOutcome> {
  const text = shareMessage(target, lang)
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; text?: string }) => Promise<void>
  }
  if (nav.share) {
    try {
      // Text only, with the link inside it. Passing `url` separately makes some
      // targets send the link and drop the sentence explaining what it is.
      await nav.share({ title: 'Resona', text })
      return 'shared'
    } catch (e) {
      // Dismissing the sheet is an AbortError and means "no", not "broken" —
      // falling through to WhatsApp would then send a message nobody asked to
      // send.
      if ((e as { name?: string })?.name === 'AbortError') return 'failed'
    }
  }
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`
  const opened = window.open(wa, '_blank', 'noopener')
  if (opened) return 'whatsapp'
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/**
 * Whether this screen was opened from a shared link.
 *
 * Read from the hash rather than from `location.search`, because the marker
 * travels inside the hash — a static host never sees it, and neither does the
 * router.
 *
 * Answered once, at load, and remembered. A shared *frequency* rewrites the
 * address to plain `#/player` as soon as it has been applied, so a live read
 * came back false by the time the invitation rendered: the one person it is for
 * was the one person who never saw it.
 */
const ARRIVED_SHARED =
  typeof window !== 'undefined' && /[?&]s=1\b/.test(window.location.hash)

export function arrivedShared(): boolean {
  return ARRIVED_SHARED
}

/** Whether the app is running as an installed app rather than in a browser tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
