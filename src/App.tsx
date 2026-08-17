import { useEffect, useState } from 'react'
import { useRoute } from './lib/router'
import { getFrequency } from './lib/catalog'
import { useSession } from './store/sessionStore'
import { THEME_COLOR, useSettings } from './store/settingsStore'
import { useT } from './lib/i18n'
import { AuroraBackground } from './components/AuroraBackground'
import { BottomNav } from './components/BottomNav'
import { MiniPlayer } from './components/MiniPlayer'
import { HomeScreen } from './components/HomeScreen'
import { PlayerScreen } from './components/PlayerScreen'
import { FrequenciesScreen } from './components/FrequenciesScreen'
import { JourneyList } from './components/JourneyList'
import { JourneyDetail } from './components/JourneyDetail'
import { JourneyDayScreen } from './components/JourneyDayScreen'
import { PresetList } from './components/PresetList'
import { SettingsScreen } from './components/SettingsScreen'
import { HeadphoneNotice } from './components/HeadphoneNotice'
import { SplashScreen } from './components/SplashScreen'
import { AboutScreen } from './components/AboutScreen'
import { player } from './audio/SessionPlayer'

export default function App() {
  const route = useRoute()
  // Shown once per launch, not once per install: it doubles as the gesture that
  // opens the AudioContext, which every fresh page load needs again.
  const [splashDone, setSplashDone] = useState(false)
  const rootId = useSession((s) => s.config.rootId)
  const isPlaying = useSession((s) => s.isPlaying)
  const tick = useSession((s) => s.tick)
  const theme = useSettings((s) => s.theme)
  const { t, lang } = useT()

  // Re-tint the whole interface from the selected frequency.
  useEffect(() => {
    const hue = getFrequency(rootId)?.hue ?? 265
    document.documentElement.style.setProperty('--h', String(hue))
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', THEME_COLOR[theme])
  }, [rootId, theme])

  // The tab title and the document language are outside React's tree, so they
  // have to be written by hand when the language changes.
  useEffect(() => {
    document.title = `Resona — ${t('app.tagline')}`
  }, [lang, t])

  // Lock-screen controls and the return-from-background path, wired once.
  useEffect(() => {
    player.installSystemIntegration(() => useSession.getState().config)
  }, [])

  // Drive the elapsed/remaining readouts. Only runs while something is playing.
  useEffect(() => {
    if (!isPlaying) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isPlaying, tick])

  return (
    <>
      <AuroraBackground intensity={isPlaying ? 1.25 : 1} />
      <main className="min-h-full">
        {route.name === 'home' && <HomeScreen />}
        {route.name === 'player' && <PlayerScreen />}
        {route.name === 'frequencies' && <FrequenciesScreen />}
        {route.name === 'journeys' && <JourneyList />}
        {route.name === 'journey' && <JourneyDetail id={route.id} />}
        {route.name === 'journeyDay' && <JourneyDayScreen id={route.id} day={route.day} />}
        {route.name === 'presets' && <PresetList />}
        {route.name === 'settings' && <SettingsScreen />}
        {route.name === 'about' && <AboutScreen />}
      </main>
      <MiniPlayer hidden={route.name === 'player'} />
      <BottomNav current={route.name} />
      {/* The headphone question waits for the splash so two overlays never stack. */}
      {splashDone && <HeadphoneNotice />}
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </>
  )
}
