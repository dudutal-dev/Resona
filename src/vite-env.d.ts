/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Version, commit and build date, injected by `vite.config.ts`. */
declare const __BUILD__: string

declare module '*.mp4?url' {
  const src: string
  export default src
}
declare module '*.webm?url' {
  const src: string
  export default src
}
