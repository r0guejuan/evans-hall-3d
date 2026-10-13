import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import { EYE, MAX_STEP, SPAWN, collide, floorAt, locate } from './layout.js'
import { chat } from './chat.js'

const CROUCH_EYE = 1.05
const LOOK_SPEED = 0.005 // radians per touch pixel
const TURN_SPEED = 2.2 // radians per second with ← →
const TILT_SPEED = 1.4 // radians per second with ↑ ↓

// PC controls: WASD move, arrow keys look (← → turn, ↑ ↓ tilt; the mouse works too), Shift sprint, C crouch.
// Space is melee (see App.jsx); mouse look pauses while the weapon wheel is open.
// Touch controls come in through touchRef: { active, move: [x, y], look: [dx, dy] }.
export default function Player({ lockRef, mapRef, touchRef, onLock, onWhere }) {
  const { camera, gl } = useThree()
  const controls = useMemo(() => new PointerLockControls(camera, gl.domElement), [camera, gl])
  const keys = useRef({})
  const where = useRef('')
  const eye = useRef(EYE)
  const floorY = useRef(0)
  const devY = useRef(null) // dev teleport can pin the camera height
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])

  useEffect(() => {
    camera.position.set(SPAWN.x, EYE, SPAWN.z)
    camera.rotation.set(0, 0, 0)
    lockRef.current = () => controls.lock()
    const on = () => onLock(true)
    const off = () => {
      keys.current = {} // keys held during Esc never get a keyup
      onLock(false)
    }
    controls.addEventListener('lock', on)
    controls.addEventListener('unlock', off)
    const down = (e) => {
      if (e.target.closest?.('input, textarea')) return // typing in the chat, not walking
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault() // no page scroll / focus hopping
      keys.current[e.code] = true
    }
    const up = (e) => (keys.current[e.code] = false)
    const blur = () => (keys.current = {})
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      controls.removeEventListener('lock', on)
      controls.removeEventListener('unlock', off)
      controls.dispose()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [camera, controls, lockRef, onLock])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    controls.enabled = !chat.get().wheelOpen // the mouse picks a weapon instead of turning your head
    // dev only: teleport for screenshots by setting <body data-go="[x, z, yawDeg]">
    if (import.meta.env.DEV && document.body.dataset.go) {
      const [x, z, yaw, pitch = 0, y = null] = JSON.parse(document.body.dataset.go)
      devY.current = y
      delete document.body.dataset.go
      camera.position.set(x, EYE, z)
      camera.rotation.set(pitch, (yaw * Math.PI) / 180, 0, 'YXZ')
      floorY.current = floorAt(x, z)
    }
    const touch = touchRef.current
    const active = controls.isLocked || touch.active

    // touch look: drag on the right side of the screen
    if (touch.active && (touch.look[0] || touch.look[1])) {
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= touch.look[0] * LOOK_SPEED
      euler.x = Math.max(-1.45, Math.min(1.45, euler.x - touch.look[1] * LOOK_SPEED))
      camera.quaternion.setFromEuler(euler)
    }
    touch.look[0] = 0
    touch.look[1] = 0

    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()

    const k = keys.current
    // arrow keys turn the camera
    if (active && !chat.get().wheelOpen) {
      const turn = (k.ArrowLeft ? 1 : 0) - (k.ArrowRight ? 1 : 0)
      const tilt = (k.ArrowUp ? 1 : 0) - (k.ArrowDown ? 1 : 0)
      if (turn || tilt) {
        euler.setFromQuaternion(camera.quaternion)
        euler.y += turn * TURN_SPEED * dt
        euler.x = Math.max(-1.45, Math.min(1.45, euler.x + tilt * TILT_SPEED * dt))
        camera.quaternion.setFromEuler(euler)
      }
    }
    let f = 0
    let s = 0
    let sprint = false
    if (active) {
      f = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)
      s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0)
      sprint = k.ShiftLeft || k.ShiftRight
    }
    if (touch.active && (touch.move[0] || touch.move[1])) {
      f = -touch.move[1]
      s = touch.move[0]
      sprint = Math.hypot(f, s) > 0.95 // push the stick all the way to hurry
    }
    let mx = fwd.x * f - fwd.z * s
    let mz = fwd.z * f + fwd.x * s
    const l = Math.hypot(mx, mz)
    if (l > 0.05) {
      if (l > 1) {
        mx /= l
        mz /= l
      }
      const crouching = active && k.KeyC
      const speed = crouching ? 2.4 : sprint ? 9.5 : 5.5 // m/s; brisk walk, sprint is a jog
      const pos = { x: camera.position.x + mx * speed * dt, z: camera.position.z + mz * speed * dt }
      collide(pos)
      // risers: walk up one step at a time; anything taller acts like a wall
      const cur = floorAt(camera.position.x, camera.position.z)
      if (floorAt(pos.x, pos.z) - cur <= MAX_STEP) {
        camera.position.x = pos.x
        camera.position.z = pos.z
      } else if (floorAt(pos.x, camera.position.z) - cur <= MAX_STEP) {
        camera.position.x = pos.x // slide along the edge
      } else if (floorAt(camera.position.x, pos.z) - cur <= MAX_STEP) {
        camera.position.z = pos.z
      }
    }

    // crouch
    const eyeTarget = active && k.KeyC ? CROUCH_EYE : EYE
    eye.current += (eyeTarget - eye.current) * Math.min(1, dt * 12)
    const fy = floorAt(camera.position.x, camera.position.z)
    floorY.current += (fy - floorY.current) * Math.min(1, dt * 14) // smooth step up/down
    camera.position.y = devY.current ?? floorY.current + eye.current

    if (import.meta.env.DEV) document.body.dataset.pos = `${camera.position.x.toFixed(2)},${camera.position.z.toFixed(2)},${fwd.x.toFixed(2)},${fwd.z.toFixed(2)}|${touch.move.map((v) => v.toFixed(2))}`
    mapRef.current?.(camera.position.x, camera.position.z, fwd.x, fwd.z)
    const w = locate(camera.position.x, camera.position.z)
    if (w !== where.current) {
      where.current = w
      onWhere(w)
    }
  })
  return null
}
