import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { COURTYARD, H, inPoly } from './layout.js'
import { BalloonSOM, free, loopSpots } from './Decor.jsx'

// Thanksgiving decor for Evans Hall (the 🦃 level; Decor.jsx is the 🎃 one): hay bales topped with pumpkins
// and gourds along the cloister, tied cornstalk bundles, a maple-leaf garland under the ceiling, fallen
// leaves across the floors, the SOM balloon sign, and out in the courtyard a long harvest table set for a
// feast, a Yale scarecrow, and leaves piled under the autumn trees. Everything repeated is instanced.

const rand = (() => {
  let s = 2468013
  return () => ((s = (s * 16807) % 2147483647) / 2147483647)
})()

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
// a maple leaf, white on transparent (tinted per leaf)
const mapleTex = () =>
  canvasTex(128, 128, (g) => {
    g.translate(64, 70)
    g.fillStyle = '#ffffff'
    g.beginPath()
    const pts = 11
    for (let k = 0; k <= pts * 2; k++) {
      const a = (k / (pts * 2)) * Math.PI * 2 - Math.PI / 2
      const lobe = k % 2 === 0 ? 1 : 0.55
      const r = 52 * lobe * (k % 4 === 0 ? 1 : 0.86)
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r * (a > 0.3 && a < Math.PI - 0.3 ? 0.65 : 1))
    }
    g.fill()
    g.strokeStyle = 'rgba(80,40,10,0.5)' // stem and veins
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(0, 50)
    g.lineTo(0, -40)
    g.moveTo(0, 0)
    g.lineTo(-30, -20)
    g.moveTo(0, 0)
    g.lineTo(30, -20)
    g.stroke()
  })
const strawTex = () =>
  canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d9b45a'
    g.fillRect(0, 0, w, h)
    for (let k = 0; k < 500; k++) {
      g.strokeStyle = rand() < 0.5 ? 'rgba(150,110,40,0.5)' : 'rgba(250,225,140,0.6)'
      g.lineWidth = 1 + rand()
      const x = rand() * w
      const y = rand() * h
      g.beginPath()
      g.moveTo(x, y)
      g.lineTo(x + (rand() - 0.5) * 30, y + (rand() - 0.5) * 6)
      g.stroke()
    }
  })
const LEAF_COLORS = ['#b8321f', '#d4561c', '#e07b1a', '#e8a21e', '#a8291c', '#c9881a', '#8a3a14'].map((c) => new THREE.Color(c))

const PLANE = new THREE.PlaneGeometry(1, 1)
const BALE = new THREE.BoxGeometry(1.1, 0.45, 0.55)
const PUMPKIN = (() => {
  const g = new THREE.SphereGeometry(1, 20, 14)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k)
    const ribs = 1 + 0.07 * Math.cos(Math.atan2(v.z, v.x) * 10)
    p.setXYZ(k, v.x * ribs, v.y * 0.78, v.z * ribs)
  }
  g.computeVertexNormals()
  return g
})()
const SPH = new THREE.SphereGeometry(1, 12, 8)
const STALK = new THREE.CylinderGeometry(0.012, 0.02, 1, 5)

function useInstances(ref, items, place) {
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const c = new THREE.Color()
    items.forEach((it, k) => {
      const o = place(it)
      q.setFromEuler(e.set(...(o.r || [0, 0, 0])))
      m.compose(p.set(...o.p), q, s.set(...(o.s || [1, 1, 1])))
      ref.current.setMatrixAt(k, m)
      if (o.c) ref.current.setColorAt(k, c.set(o.c))
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [ref, items, place])
}

export default function FallDecor() {
  const M = useMemo(
    () => ({
      straw: new THREE.MeshStandardMaterial({ map: strawTex(), roughness: 0.95 }),
      pumpkin: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }),
      stem: new THREE.MeshStandardMaterial({ color: '#4a5b22', roughness: 0.9 }),
      leaf: new THREE.MeshStandardMaterial({ map: mapleTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }),
      stalk: new THREE.MeshStandardMaterial({ color: '#c9a65a', roughness: 0.9 }),
      twine: new THREE.MeshStandardMaterial({ color: '#7a5a2e', roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.7 }),
      cloth: new THREE.MeshStandardMaterial({ color: '#a3401c', roughness: 0.85 }),
      runner: new THREE.MeshStandardMaterial({ color: '#e8d3a0', roughness: 0.85 }),
      plate: new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.4 }),
      crust: new THREE.MeshStandardMaterial({ color: '#c98a4a', roughness: 0.7 }),
      pie: new THREE.MeshStandardMaterial({ color: '#c8641c', roughness: 0.6 }),
      horn: new THREE.MeshStandardMaterial({ color: '#a8743a', roughness: 0.85 }),
      navy: new THREE.MeshStandardMaterial({ color: '#00356b', roughness: 0.8 }),
      flannel: new THREE.MeshStandardMaterial({ color: '#9a2a22', roughness: 0.9 }),
      denim: new THREE.MeshStandardMaterial({ color: '#3b5a85', roughness: 0.9 }),
      burlap: new THREE.MeshStandardMaterial({ color: '#c9a978', roughness: 0.95 }),
      ink: new THREE.MeshStandardMaterial({ color: '#2a1a10' }),
    }),
    [],
  )

  // ---------- where everything goes (deterministic)
  const L = useMemo(() => {
    // hay bales along the outer wall, a pumpkin and gourds on each
    const bales = loopSpots(12, 2.0, 3).filter((p) => free(p.x, p.z, 0.7))
    const pumpkins = []
    const gourds = []
    for (const b of bales) {
      const top = 0.45
      pumpkins.push({ x: b.x, y: top, z: b.z, r: 0.18 + rand() * 0.1, c: rand() < 0.8 ? '#e0741c' : '#efe6d2' })
      for (let k = 0; k < 3; k++) gourds.push({ x: b.x + (rand() - 0.5) * 0.8, y: top + 0.05, z: b.z + (rand() - 0.5) * 0.3, r: 0.06 + rand() * 0.04, c: ['#e8c23a', '#5f7a2e', '#f2ead2', '#d4651c'][Math.floor(rand() * 4)] })
    }
    // more pumpkins by the courtyard glass
    for (const p of loopSpots(15, -2.0, 9).filter((q) => free(q.x, q.z))) pumpkins.push({ x: p.x, y: 0, z: p.z, r: 0.2 + rand() * 0.14, c: rand() < 0.75 ? '#e0741c' : '#efe6d2' })
    // cornstalk bundles
    const corn = loopSpots(26, 2.15, 16).filter((p) => free(p.x, p.z, 0.5))
    const stalks = []
    for (const c of corn) for (let k = 0; k < 14; k++) {
      const a = rand() * Math.PI * 2
      const lean = 0.05 + rand() * 0.12
      stalks.push({ x: c.x + Math.cos(a) * 0.12, z: c.z + Math.sin(a) * 0.12, h: 1.8 + rand() * 0.6, rx: Math.sin(a) * lean, rz: -Math.cos(a) * lean })
    }
    // the garland: maple leaves strung under the ceiling along the outer wall
    const garland = []
    const anchors = loopSpots(3, 2.3)
    anchors.forEach((a, k) => {
      const b = anchors[(k + 1) % anchors.length]
      for (let j = 0; j < 6; j++) {
        const u = j / 6
        garland.push({ x: a.x + (b.x - a.x) * u, y: H - 0.22 - Math.sin(u * Math.PI) * 0.3, z: a.z + (b.z - a.z) * u, rot: rand() * 6, c: LEAF_COLORS[Math.floor(rand() * LEAF_COLORS.length)] })
      }
    })
    // fallen leaves: scattered along the hallways, heaped under the courtyard trees
    const fallen = []
    for (const p of loopSpots(0.9, 0)) {
      for (let k = 0; k < 2; k++) {
        const x = p.x + (rand() - 0.5) * 4.4
        const z = p.z + (rand() - 0.5) * 4.4
        if (free(x, z, 0.1)) fallen.push({ x, y: 0.012 + rand() * 0.004, z, rot: rand() * 6, s: 0.16 + rand() * 0.1 })
      }
    }
    for (let k = 0; k < 900; k++) {
      const x = (rand() - 0.5) * 38
      const z = (rand() - 0.5) * 34
      if (inPoly(x, z, COURTYARD)) fallen.push({ x, y: 0.02 + rand() * 0.01, z, rot: rand() * 6, s: 0.2 + rand() * 0.14 })
    }
    return { bales, pumpkins, gourds, stalks, corn, garland, fallen }
  }, [])

  const bales = useRef()
  const pumps = useRef()
  const pStems = useRef()
  const gourds = useRef()
  const stalks = useRef()
  const ties = useRef()
  const garland = useRef()
  const fallen = useRef()
  useInstances(bales, L.bales, useMemo(() => (b) => ({ p: [b.x, 0.225, b.z], r: [0, Math.atan2(b.tx, b.tz) + Math.PI / 2, 0] }), []))
  useInstances(pumps, L.pumpkins, useMemo(() => (p) => ({ p: [p.x, p.y + p.r * 0.78, p.z], s: [p.r, p.r, p.r], c: p.c }), []))
  useInstances(pStems, L.pumpkins, useMemo(() => (p) => ({ p: [p.x, p.y + p.r * 1.55, p.z], s: [p.r * 0.12, p.r * 0.5, p.r * 0.12] }), []))
  useInstances(gourds, L.gourds, useMemo(() => (g) => ({ p: [g.x, g.y + g.r, g.z], s: [g.r, g.r * 1.3, g.r], c: g.c }), []))
  useInstances(stalks, L.stalks, useMemo(() => (s) => ({ p: [s.x, s.h / 2, s.z], r: [s.rx, 0, s.rz], s: [1, s.h, 1] }), []))
  useInstances(ties, L.corn, useMemo(() => (c) => ({ p: [c.x, 0.85, c.z], s: [0.17, 0.05, 0.17] }), []))
  useInstances(garland, L.garland, useMemo(() => (g) => ({ p: [g.x, g.y, g.z], r: [0.3, g.rot, 0.2], s: [0.34, 0.34, 0.34], c: g.c }), []))
  useInstances(fallen, L.fallen, useMemo(() => (f) => ({ p: [f.x, f.y, f.z], r: [-Math.PI / 2, 0, f.rot], s: [f.s, f.s, f.s], c: LEAF_COLORS[Math.floor((f.rot * 97) % LEAF_COLORS.length)] }), []))

  return (
    <group>
      <BalloonSOM />
      <instancedMesh ref={bales} args={[BALE, M.straw, L.bales.length]} castShadow receiveShadow />
      <instancedMesh ref={pumps} args={[PUMPKIN, M.pumpkin, L.pumpkins.length]} castShadow />
      <instancedMesh ref={pStems} args={[STALK, M.stem, L.pumpkins.length]} />
      <instancedMesh ref={gourds} args={[SPH, M.pumpkin, L.gourds.length]} />
      <instancedMesh ref={stalks} args={[STALK, M.stalk, L.stalks.length]} castShadow />
      <instancedMesh ref={ties} args={[new THREE.CylinderGeometry(1, 1, 1, 10), M.twine, L.corn.length]} />
      <instancedMesh ref={garland} args={[PLANE, M.leaf, L.garland.length]} frustumCulled={false} />
      <instancedMesh ref={fallen} args={[PLANE, M.leaf, L.fallen.length]} frustumCulled={false} receiveShadow />
      <HarvestTable M={M} />
      <Scarecrow M={M} />
    </group>
  )
}

// a long harvest table in the courtyard, set for a feast: tablecloth and runner, plates, pies, a cornucopia
function HarvestTable({ M }) {
  const X = 0
  const Z = 6
  const len = 6
  const pies = [-2.2, -0.8, 0.8, 2.2]
  return (
    <group position={[X, 0, Z]}>
      <mesh position={[0, 0.76, 0]} material={M.cloth} castShadow receiveShadow>
        <boxGeometry args={[len, 0.06, 1.2]} />
      </mesh>
      <mesh position={[0, 0.795, 0]} material={M.runner}>
        <boxGeometry args={[len - 0.2, 0.01, 0.4]} />
      </mesh>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sz}`} position={[sx * (len / 2 - 0.15), 0.37, sz * 0.48]} material={M.wood}>
          <boxGeometry args={[0.08, 0.74, 0.08]} />
        </mesh>
      )))}
      {/* benches */}
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[0, 0.42, sz * 0.95]} material={M.wood} castShadow>
          <boxGeometry args={[len - 0.4, 0.06, 0.32]} />
        </mesh>
      ))}
      {/* plates down both sides */}
      {Array.from({ length: 8 }, (_, k) => [-1, 1].map((sz) => (
        <mesh key={`${k}${sz}`} position={[-len / 2 + 0.55 + k * 0.7, 0.8, sz * 0.4]} material={M.plate}>
          <cylinderGeometry args={[0.13, 0.11, 0.015, 18]} />
        </mesh>
      )))}
      {/* pumpkin pies */}
      {pies.map((x) => (
        <group key={x} position={[x, 0.82, 0]}>
          <mesh material={M.crust}>
            <cylinderGeometry args={[0.17, 0.14, 0.05, 20]} />
          </mesh>
          <mesh position={[0, 0.027, 0]} material={M.pie}>
            <cylinderGeometry args={[0.15, 0.15, 0.01, 20]} />
          </mesh>
        </group>
      ))}
      {/* the cornucopia, spilling gourds */}
      <group position={[0, 0.95, 0]} rotation={[0, 0, Math.PI / 2 - 0.25]}>
        <mesh material={M.horn}>
          <coneGeometry args={[0.18, 0.7, 14, 1, true]} />
        </mesh>
      </group>
      {[
        [0.42, '#e0741c', 0.09],
        [0.52, '#e8c23a', 0.06],
        [0.36, '#5f7a2e', 0.06],
        [0.6, '#a8291c', 0.055],
      ].map(([x, c, r], k) => (
        <mesh key={k} position={[x, 0.85 + r, (k % 2 ? 1 : -1) * 0.08]} scale={[r, r * 1.2, r]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={c} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// a scarecrow in a Yale-blue cap and a flannel shirt, on a hay bale
function Scarecrow({ M }) {
  return (
    <group position={[-9, 0, -6]} rotation={[0, 0.5, 0]}>
      <mesh position={[0, 0.25, 0]} material={M.straw}>
        <boxGeometry args={[1.0, 0.5, 0.5]} />
      </mesh>
      <mesh position={[0, 1.2, 0]} material={M.twine}>
        <cylinderGeometry args={[0.03, 0.03, 2.4, 6]} />
      </mesh>
      {/* arms out on a crossbar, straw at the cuffs */}
      <mesh position={[0, 1.55, 0]} rotation={[0, 0, Math.PI / 2]} material={M.flannel}>
        <cylinderGeometry args={[0.06, 0.06, 1.2, 8]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.64, 1.55, 0]} rotation={[0, 0, sx * 1.2]} material={M.stalk}>
          <coneGeometry args={[0.06, 0.15, 6]} />
        </mesh>
      ))}
      <mesh position={[0, 1.38, 0]} material={M.flannel}>
        <cylinderGeometry args={[0.2, 0.22, 0.55, 10]} />
      </mesh>
      <mesh position={[0, 0.92, 0]} material={M.denim}>
        <cylinderGeometry args={[0.22, 0.2, 0.4, 10]} />
      </mesh>
      {/* burlap head, stitched smile, Yale cap */}
      <mesh position={[0, 1.82, 0]} material={M.burlap}>
        <sphereGeometry args={[0.16, 14, 10]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.055, 1.86, 0.14]} material={M.ink}>
          <boxGeometry args={[0.035, 0.035, 0.01]} />
        </mesh>
      ))}
      <mesh position={[0, 1.77, 0.148]} material={M.ink}>
        <boxGeometry args={[0.1, 0.01, 0.01]} />
      </mesh>
      <mesh position={[0, 1.95, 0]} material={M.navy}>
        <sphereGeometry args={[0.165, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[0, 1.95, 0.14]} rotation={[0.25, 0, 0]} material={M.navy}>
        <boxGeometry args={[0.22, 0.015, 0.14]} />
      </mesh>
    </group>
  )
}
