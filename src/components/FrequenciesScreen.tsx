import { useState } from 'react'
import { useT } from '../lib/i18n'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import type { Frequency } from '../lib/types'
import { FrequencyPicker } from './FrequencyPicker'
import { InfoPanel } from './InfoPanel'
import { Screen } from './ui'

export function FrequenciesScreen() {
  const { t } = useT()
  const { config, setRoot, setBeat } = useSession()
  const [info, setInfo] = useState<Frequency | null>(null)

  return (
    <Screen
      title={t('freq.title')}
      subtitle={t('freq.subtitle')}
      action={
        <button onClick={() => navigate('/player')} className="cta flex-none px-5 py-2.5 text-[13.5px]">
          {t('freq.play')}
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
