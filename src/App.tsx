import { useEffect } from 'react'
import { useRoute } from './lib/router'
import { getFrequency } from './lib/catalog'
import { useSession } from './store/sessionStore'
import { useSettings } from './store/settingsStore'
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

export default function App() {
  const route = useRoute()
  const rootId = useSession((s) => s.config.rootId)
  const isPlaying = useSession((s) => s.isPlaying)
  const tick = useSession((s) => s.tick)
  const theme = useSettings((s) => s.theme)

  // Re-tint the whole interface from the selected frequency.
  useEffect(() => {
    const hue = getFrequency(rootId)?.hue ?? 265
    document.documentElement.style.setProperty('--h', String(hue))
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'light' ? '#f3f0fb' : '#05030e')
  }, [rootId, theme])

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
      </main>
      <MiniPlayer hidden={route.name === 'player'} />
      <BottomNav current={route.name} />
      <HeadphoneNotice />
    </>
  )
}
