import { useState } from 'react'
import { TIMER_LABEL } from '../audio/SessionPlayer'
import { BUILTIN_AMBIENCE } from '../audio/Ambience'
import { getFrequency } from '../lib/catalog'
import { navigate } from '../lib/router'
import { useSession } from '../store/sessionStore'
import { usePresets } from '../store/presetsStore'
import type { Preset } from '../lib/types'
import { Card, EmptyState, Screen, Sheet } from './ui'

function describe(preset: Preset): string {
  const root = getFrequency(preset.config.rootId)
  const beat = preset.config.beatId ? getFrequency(preset.config.beatId) : null
  const amb = BUILTIN_AMBIENCE.find((a) => a.id === preset.config.ambience)
  const parts = [root ? `${root.hz} Hz` : null, beat ? `${preset.config.beatHz} Hz` : null]
  const timer =
    preset.config.timerMode === 'custom'
      ? `${preset.config.customMinutes} דק׳`
      : TIMER_LABEL[preset.config.timerMode]
  return [parts.filter(Boolean).join(' + '), amb?.label ?? preset.ambienceTrack, timer]
    .filter(Boolean)
    .join(' · ')
}

export function PresetList() {
  const { presets, remove, rename, update } = usePresets()
  const { config, loadConfig, toggle } = useSession()
  const [editing, setEditing] = useState<Preset | null>(null)
  const [name, setName] = useState('')

  const handlePlay = async (preset: Preset) => {
    loadConfig(preset.config, null)
    navigate('/player')
    // loadConfig writes synchronously through the store, so the player picks up
    // the new config on this same tick.
    await toggle()
  }

  return (
    <Screen title="הפריסטים שלי" subtitle="שילובים שמורים, נטענים בדיוק כפי שנשמרו" onBack>
      {presets.length === 0 ? (
        <EmptyState
          title="עדיין אין פריסטים"
          body="בנה שילוב במסך הנגן — תדר, שכבות, עוצמות וטיימר — ושמור אותו בשם."
          action={
            <button onClick={() => navigate('/player')} className="btn btn-primary">
              למסך הנגן
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => {
            const root = getFrequency(preset.config.rootId)
            return (
              <Card key={preset.id}>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => void handlePlay(preset)}
                    aria-label={`נגן את ${preset.name}`}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform active:scale-95"
                    style={{
                      background: `hsl(${root?.hue ?? 265} 85% 62% / 0.16)`,
                      border: `1px solid hsl(${root?.hue ?? 265} 85% 65% / 0.42)`,
                      color: `hsl(${root?.hue ?? 265} 90% 75%)`,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" />
                    </svg>
                  </button>

                  <button onClick={() => void handlePlay(preset)} className="min-w-0 flex-1 text-right">
                    <p className="truncate text-sm font-semibold">{preset.name}</p>
                    <p className="txt-3 ltr mt-0.5 truncate text-[11px]">{describe(preset)}</p>
                  </button>

                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditing(preset)
                        setName(preset.name)
                      }}
                      aria-label={`עריכת ${preset.name}`}
                      className="btn btn-ghost h-9 w-9 rounded-full p-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`למחוק את "${preset.name}"?`)) remove(preset.id)
                      }}
                      aria-label={`מחיקת ${preset.name}`}
                      className="btn btn-ghost h-9 w-9 rounded-full p-0 txt-3"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="עריכת פריסט">
        <label className="block text-sm font-medium" htmlFor="rename">
          שם
        </label>
        <input
          id="rename"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="glass mt-2 w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={{ color: 'var(--txt)' }}
        />
        <button
          onClick={() => {
            if (editing) rename(editing.id, name)
            setEditing(null)
          }}
          className="btn btn-primary mt-4 w-full"
        >
          שמור שם
        </button>
        <button
          onClick={() => {
            if (editing) update(editing.id, config)
            setEditing(null)
          }}
          className="btn mt-2 w-full text-xs"
        >
          עדכן להגדרות הנוכחיות במיקסר
        </button>
      </Sheet>
    </Screen>
  )
}
