import { DRUMS, ellPt } from './layout.js'

// Walkable routes through Floor 2. The cloister centerline loop (RING) is the spine everyone navigates
// by; ROOMS gives each classroom its front-of-room spot and the door route out to the loop.

// cloister centerline loop
export const RING = Array.from({ length: 120 }, (_, i) => {
  const t = (i / 120) * Math.PI * 2
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [24.4 * Math.sign(c) * Math.pow(Math.abs(c), 1 / 3), 21.4 * Math.sign(s) * Math.pow(Math.abs(s), 1 / 3)]
})
export const nearestRing = (p) => {
  let best = 0
  let bd = Infinity
  RING.forEach((q, i) => {
    const d = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return best
}
export function ringPath(a, b) {
  const n = RING.length
  const fwd = (b - a + n) % n
  const step = fwd <= n / 2 ? 1 : -1
  const out = []
  for (let i = a; i !== b; i = (i + step + n) % n) out.push(RING[i])
  out.push(RING[b])
  return out
}

// for each classroom: the spot at the front of the room, and the door route out to the cloister
export const ROOMS = DRUMS.map((d) => {
  const { fc, back, t } = d.front
  const inside = [fc[0] + back[0] * 1.6, fc[1] + back[1] * 1.6]
  const routes = d.doors.map((a) => {
    const p = ellPt(d.c, d.rx, d.rz, a)
    const n = [p[0] - d.c[0], p[1] - d.c[1]]
    const l = Math.hypot(...n)
    const inner = [p[0] - (n[0] / l) * 0.7, p[1] - (n[1] / l) * 0.7]
    const outer = [p[0] + (n[0] / l) * 1.0, p[1] + (n[1] / l) * 1.0]
    const ring = nearestRing(outer)
    return { inner, outer, ring, cost: Math.hypot(RING[ring][0] - outer[0], RING[ring][1] - outer[1]) }
  })
  const exit = routes.reduce((a, b) => (b.cost < a.cost ? b : a))
  return { inside, back, t, ...exit }
})
