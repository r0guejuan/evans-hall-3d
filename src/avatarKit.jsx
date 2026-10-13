import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { chat, useTalkable } from './chat.js'

// Shared building blocks for the chattable professor avatars (Zaman.jsx, Schott.jsx, ...).
// Avatars are built from primitives, face +z, and their own right hand is at -x.

const mats = new Map()
export const m = (color, o = {}) => {
  const k = color + JSON.stringify(o)
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o }))
  return mats.get(k)
}
export const SPH = new THREE.SphereGeometry(1, 24, 16)
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 20)
export const TORSO = new THREE.CylinderGeometry(0.92, 1, 1, 28)
export const BOX = new THREE.BoxGeometry(1, 1, 1)
export const TORUS = new THREE.TorusGeometry(1, 0.12, 8, 28)
export const CAP = new THREE.CapsuleGeometry(1, 1, 6, 12)
export const CONE = new THREE.ConeGeometry(1, 1, 24)

export const B = ({ g = SPH, c, p, s, r = [0, 0, 0], o }) => <mesh geometry={g} material={m(c, o)} position={p} scale={s} rotation={r} />

export const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
export const ease = (cur, target, k) => cur + (target - cur) * k

// Makes an avatar chattable and gives it the conversation pose: scan the room while idle, turn to
// face the player and look up/down at them while chatting. Returns a ref the avatar's own useFrame
// can read: { talking, speaking }.
export function useConversation(id, root, head, { rotation = 0, eyeHeight = 1.69, scan = 0.35 } = {}) {
  const { camera } = useThree()
  const yaw = useRef(rotation)
  const wp = useMemo(() => new THREE.Vector3(), [])
  const state = useRef({ talking: false, speaking: false })
  useTalkable(id, root)
  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const s = chat.get()
    const talking = s.talkingTo === id
    state.current.talking = talking
    state.current.speaking = talking && performance.now() < s.speakingUntil

    root.current.getWorldPosition(wp)
    const dx = camera.position.x - wp.x
    const dz = camera.position.z - wp.z
    const target = talking ? Math.atan2(dx, dz) : rotation + Math.sin(t * 0.4) * scan
    yaw.current += wrap(target - yaw.current) * Math.min(1, dt * (talking ? 5 : 2))
    root.current.rotation.y = yaw.current

    // rotation.x < 0 tilts the face up
    const pitch = talking ? Math.atan2(camera.position.y - (wp.y + eyeHeight), Math.hypot(dx, dz)) : 0
    head.current.rotation.x = ease(head.current.rotation.x, -Math.max(-0.45, Math.min(0.45, pitch)), Math.min(1, dt * 6))
  })
  return state
}
