import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraScene, hueFor, pulseRateFor } from './ChakraScene'

/**
 * Development harness for `ChakraScene`, served at /chakra.html.
 *
 * It exists so the scene can be looked at and driven without wiring it into the
 * app, and so the two mappings it turns on — pitch to hue, pitch to a watchable
 * pulse rate — can be read off the screen instead of taken on trust. Under
 * `StrictMode`, because a scene holding GPU resources should be mounted twice on
 * purpose before anyone trusts its cleanup.
 */
const FREQUENCIES = [174, 285, 396, 417, 432, 528, 639, 741, 852, 963]

function Demo() {
  const [hz, setHz] = useState(528)
  const [autoRotate, setAutoRotate] = useState(false)
  const [mounted, setMounted] = useState(true)

  return (
    <div style={{ position: 'relative', height: '100%', background: '#000' }}>
      {mounted && <ChakraScene frequencyHz={hz} autoRotate={autoRotate} />}

      <div
        style={{
          position: 'absolute',
          insetInline: 0,
          bottom: 0,
          padding: 16,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
          font: '13px system-ui, sans-serif',
          color: '#cfd4e6',
        }}
      >
        {FREQUENCIES.map((f) => (
          <button
            key={f}
            onClick={() => setHz(f)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,.16)',
              background: f === hz ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.05)',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            {f} Hz
          </button>
        ))}
        <label style={{ marginInlineStart: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={(e) => setAutoRotate(e.target.checked)}
          />{' '}
          auto-rotate
        </label>
        {/* Unmounting is the point: it is how the disposal path gets exercised. */}
        <button
          onClick={() => setMounted((m) => !m)}
          style={{
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,.16)',
            background: 'rgba(255,255,255,.05)',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          {mounted ? 'unmount' : 'mount'}
        </button>
        <span style={{ opacity: 0.65 }}>
          hue {(hueFor(hz) * 360).toFixed(0)}° · pulse {pulseRateFor(hz).toFixed(3)} Hz
        </span>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
)
