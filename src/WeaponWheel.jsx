import { useEffect, useRef, useState } from 'react'
import { chat, useChat } from './chat.js'
import { equip, wheelOptions } from './Rivals.jsx'

// The weapon wheel. Hold Tab: time slows, mouse look pauses, and you flick the mouse toward a slice;
// release Tab to equip it. Melee picks go to Space, everything else to L / right click.
// On touch, tap a slice (or the middle to close).

const R = 150 // px from the center to each slice

export default function WeaponWheel() {
  const open = useChat((s) => s.wheelOpen)
  const [sel, setSel] = useState(null)
  const selRef = useRef(null)
  const vec = useRef([0, 0])
  const opts = open ? wheelOptions() : []
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    if (!open) return
    vec.current = [0, 0]
    selRef.current = null
    setSel(null)
    const n = optsRef.current.length
    const pick = (i) => {
      selRef.current = i
      setSel(i)
    }
    // the cursor is locked, so read raw mouse movement and turn it into a direction
    const move = (e) => {
      let [x, y] = vec.current
      x += e.movementX
      y += e.movementY
      const len = Math.hypot(x, y)
      if (len > 120) {
        x = (x / len) * 120
        y = (y / len) * 120
      }
      vec.current = [x, y]
      if (len < 25) return
      const a = (Math.atan2(x, -y) + Math.PI * 2) % (Math.PI * 2) // 0 at the top, clockwise
      pick(Math.round(a / ((Math.PI * 2) / n)) % n)
    }
    const release = (e) => {
      if (e.code !== 'Tab') return
      e.preventDefault()
      const o = optsRef.current[selRef.current]
      if (o?.ready) equip(o.id)
      chat.set({ wheelOpen: false })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('keyup', release)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('keyup', release)
    }
  }, [open])

  if (!open) return null
  const n = opts.length
  const current = opts[sel]
  return (
    <div className="wheel" role="dialog" aria-label="Weapon wheel">
      <div className="wheel-ring">
        {opts.map((o, i) => {
          const a = (i / n) * Math.PI * 2
          return (
            <button
              key={o.id}
              className={['slice', o.kind, i === sel && 'sel', o.on && 'on', !o.ready && 'locked'].filter(Boolean).join(' ')}
              style={{ transform: `translate(${Math.sin(a) * R}px, ${-Math.cos(a) * R}px)` }}
              onClick={() => {
                if (o.ready) equip(o.id)
                chat.set({ wheelOpen: false })
              }}
              aria-label={`${o.name}${o.ready ? '' : ' (locked)'}`}
            >
              <span className="ico">{o.ready ? o.icon : '🔒'}</span>
              <span className="nm">{o.name}</span>
              {o.count != null && <span className="ct">×{o.count}</span>}
            </button>
          )
        })}
        <button className="hub" onClick={() => chat.set({ wheelOpen: false })} aria-label="Close the weapon wheel">
          {current ? (
            <>
              <b>{current.name}</b>
              <small>{current.ready ? (current.kind === 'melee' ? 'melee · Space' : 'long range · L') : 'buy it at the Endowment Office'}</small>
            </>
          ) : (
            <small>flick toward a weapon, release Tab</small>
          )}
        </button>
      </div>
    </div>
  )
}
