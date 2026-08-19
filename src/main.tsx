import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { watchUncaught } from './lib/diagnostics'
import App from './App'
import './index.css'

// `autoUpdate` — a personal-use app should never nag about a new version.
registerSW({ immediate: true })

// Before anything else renders, so an error thrown on the way up is recorded.
watchUncaught()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
