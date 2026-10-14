import * as THREE from 'three'

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function tex(c, repeat) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16 // keeps floors crisp at grazing angles (clamped to what the GPU supports)
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  return t
}

// Photo-scanned PBR texture sets in public/textures/<name>/ (see public/textures/CREDITS.md).
// Clones share the uploaded image, so the same set can tile at different scales for free.
const loader = new THREE.TextureLoader()
const sets = new Map()
export function pbr(name, repeat = [1, 1]) {
  if (!sets.has(name)) {
    const base = `${import.meta.env.BASE_URL}textures/${name}/`
    const load = (file, srgb) => {
      const t = loader.load(base + file)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.anisotropy = 16
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      return t
    }
    sets.set(name, { map: load('Color.jpg', true), normalMap: load('NormalGL.jpg'), roughnessMap: load('Roughness.jpg') })
  }
  const out = {}
  for (const [k, t] of Object.entries(sets.get(name))) {
    out[k] = t.clone()
    out[k].repeat.set(repeat[0], repeat[1])
  }
  return out
}

export function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
}

// per-pixel grain: breaks up flat fills so surfaces read as material instead of solid blocks
function grain(g, w, h, amount, seed = 1) {
  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  const r = rng(seed)
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount
    d[i] += n
    d[i + 1] += n
    d[i + 2] += n
  }
  g.putImageData(img, 0, 0)
}

// soft blotches of light and dark, like wear, lighting falloff, or plaster
function mottle(g, w, h, count, size, alpha, seed) {
  const r = rng(seed)
  for (let i = 0; i < count; i++) {
    const x = r() * w
    const y = r() * h
    const rad = size * (0.5 + r())
    const grd = g.createRadialGradient(x, y, 0, x, y, rad)
    const c = r() > 0.5 ? '255,255,255' : '0,0,0'
    grd.addColorStop(0, `rgba(${c},${alpha})`)
    grd.addColorStop(1, `rgba(${c},0)`)
    g.fillStyle = grd
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
}

// glossy navy drum panels in horizontal bands
export function drumTex() {
  const S = 1024
  const [c, g] = canvas(S, S)
  const grd = g.createLinearGradient(0, 0, 0, S)
  grd.addColorStop(0, '#0a1644')
  grd.addColorStop(0.5, '#132c78')
  grd.addColorStop(1, '#0a1540')
  g.fillStyle = grd
  g.fillRect(0, 0, S, S)
  g.fillStyle = 'rgba(0,0,0,0.55)'
  for (let y = 0; y < S; y += 256) g.fillRect(0, y, S, 6)
  g.fillStyle = 'rgba(0,0,0,0.35)'
  for (let x = 0; x < S; x += 340) g.fillRect(x, 0, 3, S)
  // soft sheen on each panel
  for (let y = 0; y < S; y += 256) {
    const sh = g.createLinearGradient(0, y, 0, y + 256)
    sh.addColorStop(0, 'rgba(160,190,255,0.14)')
    sh.addColorStop(0.35, 'rgba(160,190,255,0.03)')
    sh.addColorStop(1, 'rgba(0,0,0,0.12)')
    g.fillStyle = sh
    g.fillRect(0, y + 6, S, 250)
  }
  grain(g, S, S, 6, 4)
  return tex(c, [8, 1])
}

// teak slat wall: dark gaps between grained boards
export function slatsTex() {
  const [c, g] = canvas(256, 512)
  const r = rng(13)
  for (let y = 0; y < 512; y += 32) {
    g.fillStyle = '#24140a'
    g.fillRect(0, y, 256, 32)
    g.fillStyle = y % 64 ? '#8d522a' : '#94592e'
    g.fillRect(0, y + 4, 256, 23)
    for (let k = 0; k < 10; k++) {
      g.strokeStyle = r() > 0.5 ? 'rgba(60,30,10,0.3)' : 'rgba(230,160,100,0.18)'
      g.lineWidth = 0.6 + r()
      const yy = y + 5 + r() * 21
      g.beginPath()
      g.moveTo(0, yy)
      g.bezierCurveTo(90, yy + r() * 3 - 1.5, 170, yy + r() * 3 - 1.5, 256, yy)
      g.stroke()
    }
    // a soft highlight along the top edge of each board
    g.fillStyle = 'rgba(255,220,180,0.12)'
    g.fillRect(0, y + 4, 256, 2)
  }
  grain(g, 256, 512, 14, 5)
  return tex(c)
}

// sage plaster walls with reveal lines
export function sageTex() {
  const S = 512
  const [c, g] = canvas(S, S)
  g.fillStyle = '#aeb08a'
  g.fillRect(0, 0, S, S)
  mottle(g, S, S, 60, 70, 0.05, 17)
  g.fillStyle = 'rgba(40,45,30,0.55)'
  for (const y of [140, 280, 420]) g.fillRect(0, y, S, 5)
  g.fillStyle = 'rgba(255,255,240,0.18)'
  for (const y of [146, 286, 426]) g.fillRect(0, y, S, 2)
  grain(g, S, S, 10, 8)
  return tex(c)
}

export function booksTex() {
  const [c, g] = canvas(1024, 512)
  g.fillStyle = '#5a3a20'
  g.fillRect(0, 0, 1024, 512)
  const r = rng(11)
  const cols = ['#7a1f2b', '#1f3b6b', '#2d5a3c', '#c9a227', '#e8e1d0', '#3b3b3b', '#8b5a2b', '#ff4fa3']
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = 8
    const y0 = shelf * 128 + 12
    // shadow at the back of each shelf
    g.fillStyle = '#24160b'
    g.fillRect(0, y0 - 4, 1024, 112)
    while (x < 1016) {
      const w = 10 + r() * 18
      const h = 80 + r() * 28
      g.fillStyle = cols[Math.floor(r() * cols.length)]
      g.fillRect(x, y0 + (108 - h), w, h)
      // spine highlight + title band
      g.fillStyle = 'rgba(255,255,255,0.14)'
      g.fillRect(x + 1, y0 + (108 - h), 2, h)
      g.fillStyle = 'rgba(0,0,0,0.25)'
      g.fillRect(x, y0 + (108 - h) + h * 0.25, w, 4)
      x += w + 1.5
    }
  }
  grain(g, 1024, 512, 10, 12)
  return tex(c)
}

export function stoneTex(repeat) {
  const S = 1024
  const [c, g] = canvas(S, S)
  g.fillStyle = '#d9ceb5'
  g.fillRect(0, 0, S, S)
  // each stone slightly different in tone, with recessed grout
  const r = rng(19)
  for (let row = 0; row < 16; row++) {
    const y = row * 64
    for (let x = (row % 2) * 96 - 96; x < S; x += 192) {
      const v = Math.floor((r() - 0.5) * 26)
      g.fillStyle = `rgb(${217 + v},${206 + v},${181 + v})`
      g.fillRect(x + 2, y + 2, 188, 60)
    }
  }
  mottle(g, S, S, 70, 60, 0.06, 23)
  g.strokeStyle = 'rgba(90,80,60,0.55)'
  g.lineWidth = 3
  for (let row = 0; row < 16; row++) {
    const y = row * 64
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(S, y)
    g.stroke()
    for (let x = (row % 2) * 96; x < S; x += 192) {
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x, y + 64)
      g.stroke()
    }
  }
  grain(g, S, S, 18, 7)
  return tex(c, repeat)
}

export function lawnTex() {
  const S = 512
  const [c, g] = canvas(S, S)
  g.fillStyle = '#34502a'
  g.fillRect(0, 0, S, S)
  mottle(g, S, S, 50, 60, 0.08, 29)
  const r = rng(5)
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(90,135,65,0.4)' : 'rgba(20,40,15,0.35)'
    g.fillRect(r() * S, r() * S, 1, 2 + r() * 3) // little blades
  }
  grain(g, S, S, 14, 9)
  return tex(c, [0.15, 0.15])
}

// abstract mustard / coral / sage mural (Beinecke Terrace Room)
export function muralTex() {
  const [c, g] = canvas(1024, 512)
  g.fillStyle = '#c9a26a'
  g.fillRect(0, 0, 1024, 512)
  const blobs = [
    ['#8fa58a', 120, 180, 380], ['#d9a21b', 520, 420, 420], ['#e9876a', 760, 120, 300],
    ['#e2671f', 900, 380, 260], ['#8fa58a', 420, 40, 220], ['#f2b8a0', 640, 260, 160],
  ]
  for (const [col, x, y, r] of blobs) {
    g.fillStyle = col
    g.globalAlpha = 0.9
    g.beginPath()
    g.ellipse(x, y, r, r * 0.7, 0.4, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  return tex(c)
}

export function screenTex() {
  const [c, g] = canvas(640, 360)
  const grd = g.createLinearGradient(0, 0, 640, 360)
  grd.addColorStop(0, '#1d3fd1')
  grd.addColorStop(1, '#2f6bff')
  g.fillStyle = grd
  g.fillRect(0, 0, 640, 360)
  g.fillStyle = '#7fd6ff'
  g.font = 'bold 54px Impact, "Arial Narrow", sans-serif'
  g.fillText('MGT 409', 210, 120)
  g.fillText('AI FOUNDATIONS', 150, 180)
  g.fillText('FOR MANAGERS', 160, 240)
  g.fillStyle = '#ff4fa3'
  g.fillText('VIBE ON', 230, 300)
  return tex(c)
}

export function posterTex() {
  const [c, g] = canvas(400, 800)
  g.fillStyle = '#0d0d10'
  g.fillRect(0, 0, 400, 800)
  g.fillStyle = '#ff4fa3'
  g.font = 'bold 70px Georgia, serif'
  g.fillText('MGT 409', 40, 110)
  g.font = '32px Georgia, serif'
  g.fillStyle = '#ffffff'
  g.fillText('Lecture 13', 40, 160)
  g.fillText('Walk the floor.', 40, 200)
  POSTER_TILES.forEach((color, k) => {
    g.fillStyle = color
    g.fillRect(40 + (k % 5) * 66, 260 + Math.floor(k / 5) * 80, 58, 70)
  })
  return tex(c)
}
// the poster's 6 rows x 5 columns of pink tiles (the easter egg's close-up uses the same colors)
export const POSTER_TILES = (() => {
  const r = rng(9)
  return Array.from({ length: 30 }, () => `hsl(${320 + r() * 40}, 70%, ${35 + r() * 35}%)`)
})()

export function signTex(name, num) {
  const [c, g] = canvas(256, 320)
  g.fillStyle = '#2a2a2e'
  g.fillRect(0, 0, 256, 320)
  g.fillStyle = '#f1f1f1'
  g.font = '30px Georgia, serif'
  const words = name.split(' ')
  let line = ''
  let y = 60
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (g.measureText(test).width > 220) {
      g.fillText(line, 18, y)
      y += 36
      line = w
    } else line = test
  }
  g.fillText(line, 18, y)
  g.font = '20px Georgia, serif'
  g.fillText(num, 18, 296)
  return tex(c)
}

export function exitTex() {
  const [c, g] = canvas(128, 48)
  g.fillStyle = '#1a0505'
  g.fillRect(0, 0, 128, 48)
  g.fillStyle = '#ff2b2b'
  g.font = 'bold 34px Arial, sans-serif'
  g.fillText('EXIT', 24, 37)
  return tex(c)
}

export function stairOpeningTex() {
  const [c, g] = canvas(256, 360)
  g.fillStyle = '#e8e6e2'
  g.fillRect(0, 0, 256, 360)
  for (let i = 0; i < 12; i++) {
    g.fillStyle = i % 2 ? '#1e1e22' : '#2c2c31'
    g.fillRect(40, 360 - (i + 1) * 26, 176, 26)
  }
  g.strokeStyle = '#111'
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(36, 340)
  g.lineTo(150, 30)
  g.stroke()
  return tex(c)
}

// building faces across the courtyard: glass with warm lit rooms
export function windowsTex(warm = true) {
  const [c, g] = canvas(512, 256)
  g.fillStyle = '#1d2533'
  g.fillRect(0, 0, 512, 256)
  const r = rng(warm ? 21 : 22)
  for (let x = 0; x < 512; x += 32)
    for (let y = 0; y < 256; y += 64) {
      const lit = r() > 0.25
      g.fillStyle = lit ? (warm ? '#f3d9a4' : '#c9d8f0') : '#2e3a4f'
      g.globalAlpha = lit ? 0.55 + r() * 0.4 : 1
      g.fillRect(x + 2, y + 4, 28, 56)
    }
  g.globalAlpha = 1
  return tex(c, [1, 1])
}

// made-up stairwell paintings in the spirit of the Stair G portrait
const PALETTES = [
  ['#1b2a6b', '#e63946', '#f4a261', '#2ec4b6', '#ffd166'],
  ['#0f0f12', '#ff4fa3', '#ffd400', '#00b4d8', '#ffffff'],
  ['#3a0ca3', '#f72585', '#4cc9f0', '#ffbe0b', '#06d6a0'],
  ['#264653', '#e76f51', '#e9c46a', '#2a9d8f', '#f4f1de'],
  ['#2b2d42', '#ef233c', '#edf2f4', '#8d99ae', '#ffb703'],
  ['#14213d', '#fca311', '#e5e5e5', '#d00000', '#3a86ff'],
]
export function paintingTex(seed) {
  const [c, g] = canvas(300, 400)
  const r = rng(seed * 97)
  const p = PALETTES[seed % PALETTES.length]
  g.fillStyle = p[0]
  g.fillRect(0, 0, 300, 400)
  // halo rings
  for (let i = 8; i > 0; i--) {
    g.strokeStyle = p[1 + (i % 4)]
    g.lineWidth = 8
    g.beginPath()
    g.arc(150, 150, i * 22, 0, Math.PI * 2)
    g.stroke()
  }
  // patterned bands
  for (let i = 0; i < 14; i++) {
    g.fillStyle = p[1 + Math.floor(r() * 4)]
    g.beginPath()
    const x = r() * 300
    const y = 260 + r() * 140
    g.moveTo(x, y)
    g.lineTo(x + 40, y - 30)
    g.lineTo(x + 80, y)
    g.fill()
  }
  // figure
  const skin = ['#5a3825', '#8d5524', '#c68642', '#3b2219'][seed % 4]
  g.fillStyle = p[1]
  g.fillRect(105, 140, 90, 120) // jacket
  g.fillStyle = p[3]
  g.fillRect(110, 255, 34, 105)
  g.fillRect(156, 255, 34, 105) // legs
  g.fillStyle = '#ffffff'
  g.fillRect(104, 352, 44, 16)
  g.fillRect(152, 352, 44, 16) // sneakers
  g.fillStyle = p[1]
  g.fillRect(104, 362, 44, 6)
  g.fillRect(152, 362, 44, 6)
  g.fillStyle = skin
  g.beginPath()
  g.arc(150, 112, 30, 0, Math.PI * 2)
  g.fill()
  g.fillRect(76, 150, 30, 18)
  g.fillRect(194, 120, 18, 40) // arms
  g.fillStyle = '#111'
  g.fillRect(118, 86, 64, 16) // hair
  for (let i = 0; i < 7; i++) g.fillRect(118 + i * 10, 96, 5, 50 + (i % 3) * 10)
  // dotted pattern on legs
  g.fillStyle = p[4]
  for (let i = 0; i < 30; i++) g.fillRect(112 + (i % 6) * 13, 262 + Math.floor(i / 6) * 18, 4, 4)
  return tex(c)
}
