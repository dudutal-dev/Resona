import { useState } from 'react'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import type { Frequency } from '../lib/types'
import { FrequencyPicker } from './FrequencyPicker'
import { InfoPanel } from './InfoPanel'
import { Screen } from './ui'

export function FrequenciesScreen() {
  const { config, setRoot, setBeat } = useSession()
  const [info, setInfo] = useState<Frequency | null>(null)

  return (
    <Screen
      title="תדרים"
      subtitle="בחר תדר יסוד וטווח גל מוחי — ולחץ על ⓘ כדי לראות על מה כל טענה נשענת"
      onBack
      action={
        <button onClick={() => navigate('/player')} className="btn btn-primary h-10 rounded-2xl px-4 text-xs">
          לנגן
        </button>
      }
    >
      <FrequencyPicker
        selectedRoot={config.rootId}
        selectedBeat={config.beatId}
        onSelectRoot={setRoot}
        onSelectBeat={setBeat}
        onInfo={setInfo}
      />
      <InfoPanel freq={info} open={!!info} onClose={() => setInfo(null)} />
    </Screen>
  )
}
