/**
 * Stand-in for `virtual:pwa-register` in the single-file build, where the PWA
 * plugin is disabled and there is no service worker to register.
 */
export function registerSW(_options?: unknown) {
  return async (_reloadPage?: boolean) => {}
}
