import { useEffect, useLayoutEffect, useState } from 'react'

/**
 * Hash routing, chosen deliberately: it works from `file://`, from a static
 * host without rewrite rules, and inside an installed PWA, none of which are
 * guaranteed for history routing. Small enough not to justify a dependency.
 */
export type Route =
  | { name: 'home' }
  | { name: 'player' }
  | { name: 'frequencies' }
  | { name: 'journeys' }
  | { name: 'journey'; id: string }
  | { name: 'journeyDay'; id: string; day: number }
  | { name: 'presets' }
  | { name: 'settings' }
  | { name: 'about' }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0]
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'home' }
  switch (parts[0]) {
    case 'player':
      return { name: 'player' }
    case 'frequencies':
      return { name: 'frequencies' }
    case 'presets':
      return { name: 'presets' }
    case 'settings':
      return { name: 'settings' }
    case 'about':
      return { name: 'about' }
    case 'journeys':
      return { name: 'journeys' }
    case 'journey':
      if (parts[2] === 'day' && parts[3]) {
        const day = Number(parts[3])
        if (parts[1] && Number.isFinite(day)) return { name: 'journeyDay', id: parts[1], day }
      }
      if (parts[1]) return { name: 'journey', id: parts[1] }
      return { name: 'journeys' }
    default:
      return { name: 'home' }
  }
}

export function navigate(to: string) {
  const next = to.startsWith('#') ? to : `#${to}`
  if (window.location.hash === next) return
  window.location.hash = next
}

export function back() {
  if (window.history.length > 1) window.history.back()
  else navigate('/')
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    // Safari restores the scroll position of a hash entry asynchronously, which
    // lands *after* any synchronous scroll we do during navigation — that is
    // how a screen ends up opening halfway down with its header off-screen.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  // Scroll after the new screen has rendered, not before, so the target exists
  // and there is no old-page height to scroll within. The follow-up frame wins
  // against anything the browser tries to restore behind us.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    const id = requestAnimationFrame(() => window.scrollTo(0, 0))
    return () => cancelAnimationFrame(id)
  }, [route])

  return route
}
