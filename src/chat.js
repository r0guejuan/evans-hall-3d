import { useMemo, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Professors you can talk to. The id matches backend/professors.py.
export const CHAT_PROFESSORS = {
  zaman: {
    name: 'Prof. Tauhid Zaman',
    course: 'MGT 409 · AI Foundations for Managers',
    room: 'Evans 2200',
    greeting: "Yo! Welcome to 2200 💗 This is AI Foundations for Managers. Ask me about AI, agents, LLMs, the class, which courses to take… whatever. Yo, let's get it.",
  },
  schott: {
    name: 'Prof. Peter Schott',
    course: 'MGT 407 · Statistics (EMBA)',
    room: 'Evans 2210',
    greeting: "Hey hey, welcome to 2210! ☀️ Stats for EMBAs, in plain English. Ask me anything. Quick question first though: how's your week going?",
  },
}

// Tiny shared store so the 3D scene and the DOM UI agree on who you're aiming at / talking to.
// Inside useFrame read chat.get() (no re-render); in React use useChat(selector).
let state = { aiming: null, talkingTo: null, speakingUntil: 0 }
const subs = new Set()
export const chat = {
  get: () => state,
  set(patch) {
    state = { ...state, ...patch }
    subs.forEach((f) => f())
  },
  subscribe(f) {
    subs.add(f)
    return () => subs.delete(f)
  },
}
export const useChat = (pick) => useSyncExternalStore(chat.subscribe, () => pick(state))
if (import.meta.env.DEV) window.__chat = chat // dev only: inspect UI state from the console

// Marks a 3D group as talkable: aiming the crosshair at it (within range) sets chat.aiming.
const CENTER = new THREE.Vector2(0, 0)
export function useTalkable(id, ref, range = 6) {
  const { camera } = useThree()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  useFrame(() => {
    const s = chat.get()
    let hit = false
    if (!s.talkingTo && ref.current) {
      ray.setFromCamera(CENTER, camera)
      ray.far = range
      hit = ray.intersectObject(ref.current, true).length > 0
    }
    if (hit && s.aiming !== id) chat.set({ aiming: id })
    else if (!hit && s.aiming === id) chat.set({ aiming: null })
  })
}

// One conversation per professor per page load; the backend keeps the history by session id.
const sessions = {}
const API = import.meta.env.VITE_API_URL ?? ''

export async function askProfessor(id, message) {
  sessions[id] ??= crypto.randomUUID()
  const res = await fetch(`${API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ professor_id: id, session_id: sessions[id], message }),
  })
  if (!res.ok) {
    const detail = await res.json().then((d) => d.detail).catch(() => null)
    throw new Error(typeof detail === 'string' ? detail : `Server error (${res.status})`)
  }
  return res.json() // { reply, power_ups: [{ id, name, kind, description }] }
}
