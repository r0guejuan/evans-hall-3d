// Game sound, synthesized with the Web Audio API (no audio files): a low uneasy drone, zombie groans
// that get louder as they close in, a heartbeat when you're hurt, hits, throws, explosions, and a thud when
// a zombie gets you. (No ding per kill: with a squad fighting it never stopped.)
// Browsers only allow audio after a user gesture, so start() is called from a click/key handler.

let ctx = null
let master = null
let drone = null
let muted = false
try {
  muted = localStorage.getItem('evans-muted') === '1'
} catch {
  // private mode: default to sound on
}

export const isMuted = () => muted
export function setMuted(on) {
  muted = on
  try {
    localStorage.setItem('evans-muted', on ? '1' : '0')
  } catch {
    // ignore
  }
  if (master) master.gain.setTargetAtTime(on ? 0 : 0.8, ctx.currentTime, 0.1)
}

export function start() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.8
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
}

// low, slightly detuned drone with a slow swell: the "something's wrong" bed under everything
export function ambience(on) {
  if (!ctx) return
  if (on && !drone) {
    const out = ctx.createGain()
    out.gain.value = 0
    out.gain.setTargetAtTime(0.16, ctx.currentTime, 2)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220
    lp.connect(out)
    out.connect(master)
    const oscs = [55, 55.6, 82.4].map((f) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(lp)
      o.start()
      return o
    })
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.07
    lfoGain.gain.value = 90
    lfo.connect(lfoGain)
    lfoGain.connect(lp.frequency)
    lfo.start()
    drone = { out, oscs: [...oscs, lfo] }
  } else if (!on && drone) {
    const d = drone
    drone = null
    d.out.gain.setTargetAtTime(0, ctx.currentTime, 0.8)
    setTimeout(() => d.oscs.forEach((o) => o.stop()), 4000)
  }
}

function env(node, peak, attack, decay) {
  const g = ctx.createGain()
  const t = ctx.currentTime
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  node.connect(g)
  g.connect(master)
  return g
}

function noise(seconds) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  return src
}

// you struck a zombie: a short thwack (heavier for the briefcase and thermos)
export function hit(heavy = false) {
  if (!ctx || muted) return
  const n = noise(0.2)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = heavy ? 500 : 1600
  n.connect(lp)
  env(lp, heavy ? 0.5 : 0.28, 0.005, heavy ? 0.22 : 0.1)
  n.start()
}

// a zombie hit you: a low body thud with a short pitch drop
export function hurt() {
  if (!ctx || muted) return
  const o = ctx.createOscillator()
  o.type = 'sine'
  const t = ctx.currentTime
  o.frequency.setValueAtTime(140, t)
  o.frequency.exponentialRampToValueAtTime(55, t + 0.18)
  env(o, 0.55, 0.005, 0.22)
  o.start()
  o.stop(t + 0.3)
  const n = noise(0.12)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 300
  n.connect(lp)
  env(lp, 0.3, 0.003, 0.1)
  n.start()
}

// a moaning glide downward; vol 0..1 by distance
export function groan(vol = 0.5) {
  if (!ctx || muted || vol <= 0.02) return
  const o = ctx.createOscillator()
  o.type = 'sawtooth'
  const t = ctx.currentTime
  const f = 90 + Math.random() * 60
  o.frequency.setValueAtTime(f, t)
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.3)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 500 + Math.random() * 300
  bp.Q.value = 3
  o.connect(bp)
  env(bp, 0.18 * vol, 0.25, 1.1)
  o.start()
  o.stop(t + 1.5)
}

export function whoosh() {
  if (!ctx || muted) return
  const n = noise(0.25)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 1.5
  bp.frequency.setValueAtTime(800, ctx.currentTime)
  bp.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.18)
  n.connect(bp)
  env(bp, 0.15, 0.02, 0.18)
  n.start()
}

export function boom() {
  if (!ctx || muted) return
  const n = noise(1.2)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(900, ctx.currentTime)
  lp.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 1)
  n.connect(lp)
  env(lp, 0.7, 0.01, 1)
  n.start()
}

// purchases only (deliberate, so it's a nice confirmation rather than noise)
export function coin() {
  if (!ctx || muted) return
  ;[988, 1319].forEach((f, i) => {
    const o = ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = f
    const g = ctx.createGain()
    const t = ctx.currentTime + i * 0.07
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.2)
  })
}

// lub-dub; call on an interval that shortens as health drops
export function heartbeat(vol = 0.5) {
  if (!ctx || muted) return
  ;[0, 0.18].forEach((dt, i) => {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = i ? 52 : 60
    const g = ctx.createGain()
    const t = ctx.currentTime + dt
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + 0.2)
  })
}

// an alarm sting (the Labubu heist): a low detuned brass swell with a sub hit (urgent = minor, shorter, harsher)
export function stinger(urgent = false) {
  if (!ctx || muted) return
  const t = ctx.currentTime
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t)
  out.gain.exponentialRampToValueAtTime(0.35, t + (urgent ? 0.05 : 0.4))
  out.gain.exponentialRampToValueAtTime(0.0001, t + (urgent ? 1.4 : 2.6))
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(300, t)
  lp.frequency.exponentialRampToValueAtTime(urgent ? 1800 : 1100, t + 0.6)
  lp.connect(out)
  out.connect(master)
  const notes = urgent ? [73.4, 87.3, 110] : [65.4, 98, 130.8] // D minor stab / C fifth
  notes.forEach((f) => {
    ;[-4, 4].forEach((cents) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = cents
      o.connect(lp)
      o.start(t)
      o.stop(t + 3)
    })
  })
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(70, t)
  sub.frequency.exponentialRampToValueAtTime(32, t + 0.8)
  env(sub, 0.6, 0.01, 0.9)
  sub.start(t)
  sub.stop(t + 1)
}

