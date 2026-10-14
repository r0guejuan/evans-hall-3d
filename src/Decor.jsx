import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLLIDERS, COURTYARD, H, inPoly } from './layout.js'
import { RING } from './nav.js'

// Halloween decor for Evans Hall: jack-o'-lanterns along the cloister (glowing faces, no extra lights, so
// phones stay smooth), orange + purple string lights under the ceiling, cobwebs with dangling spiders,
// bats flapping around the halls, bedsheet ghosts swaying from the ceiling, and a "RIP Harvard" graveyard
// out in the courtyard. Everything repeated is instanced.

// evenly spaced spots around the cloister loop, `off` meters sideways (+ = toward the outer wall)
function loopSpots(spacing, off, start = 0) {
  const out = []
  let acc = start
  for (let i = 0; i < RING.length; i++) {
    const a = RING[i]
    const b = RING[(i + 1) % RING.length]
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1])
    const tx = (b[0] - a[0]) / seg
    const tz = (b[1] - a[1]) / seg
    // outward normal (away from the courtyard)
    let nx = tz
    let nz = -tx
    if (nx * a[0] + nz * a[1] < 0) {
      nx = -nx
      nz = -nz
    }
    while (acc <= seg) {
      const x = a[0] + tx * acc + nx * off
      const z = a[1] + tz * acc + nz * off
      out.push({ x, z, nx, nz, tx, tz })
      acc += spacing
    }
    acc -= seg
  }
  return out
}
// keep clear of walls and furniture
const free = (x, z, r = 0.45) =>
  !COLLIDERS.some((w) => {
    const rr = r + w.t / 2
    if (x < w.minx - rr || x > w.maxx + rr || z < w.minz - rr || z > w.maxz + rr) return false
    const dx = w.b[0] - w.a[0]
    const dz = w.b[1] - w.a[1]
    const l2 = dx * dx + dz * dz
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - w.a[0]) * dx + (z - w.a[1]) * dz) / l2)) : 0
    return Math.hypot(x - (w.a[0] + dx * u), z - (w.a[1] + dz * u)) < rr
  })

const rand = (() => {
  let s = 1234567
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
// a carved jack-o'-lantern face: glowing cut-outs on transparent
const faceTex = () =>
  canvasTex(128, 128, (g) => {
    g.fillStyle = '#ffd36a'
    const tri = (pts) => {
      g.beginPath()
      g.moveTo(...pts[0])
      pts.slice(1).forEach((p) => g.lineTo(...p))
      g.fill()
    }
    tri([[30, 52], [52, 52], [41, 30]])
    tri([[76, 52], [98, 52], [87, 30]])
    tri([[56, 70], [72, 70], [64, 58]])
    g.beginPath()
    g.moveTo(24, 80)
    for (let k = 0; k <= 8; k++) g.lineTo(24 + k * 10, 80 + (k % 2 ? 12 : 0) + Math.sin((k / 8) * Math.PI) * 14)
    for (let k = 8; k >= 0; k--) g.lineTo(24 + k * 10, 96 + Math.sin((k / 8) * Math.PI) * 14 + (k % 2 ? -8 : 0))
    g.fill()
  })
const webTex = () =>
  canvasTex(256, 256, (g) => {
    g.strokeStyle = 'rgba(235,235,240,0.85)'
    g.lineWidth = 1.6
    const spokes = 9
    for (let k = 0; k < spokes; k++) {
      const a = (k / (spokes - 1)) * (Math.PI / 2)
      g.beginPath()
      g.moveTo(0, 0)
      g.lineTo(Math.cos(a) * 256, Math.sin(a) * 256)
      g.stroke()
    }
    for (let r = 26; r < 250; r += 24) {
      g.beginPath()
      for (let k = 0; k < spokes; k++) {
        const a = (k / (spokes - 1)) * (Math.PI / 2)
        const rr = r + Math.sin(k * 1.7 + r) * 4
        const x = Math.cos(a) * rr
        const y = Math.sin(a) * rr
        k ? g.quadraticCurveTo(Math.cos(a - 0.1) * (rr - 8), Math.sin(a - 0.1) * (rr - 8), x, y) : g.moveTo(x, y)
      }
      g.stroke()
    }
  })
const stoneTex = (text) =>
  canvasTex(256, 320, (g, w, h) => {
    g.fillStyle = '#6d6f73'
    g.fillRect(0, 0, w, h)
    for (let k = 0; k < 900; k++) {
      g.fillStyle = `rgba(${rand() < 0.5 ? '30,32,36' : '160,162,168'},${rand() * 0.18})`
      g.fillRect(rand() * w, rand() * h, 3, 3)
    }
    g.fillStyle = '#2b2d31'
    g.textAlign = 'center'
    g.font = 'bold 54px Georgia, serif'
    g.fillText('R.I.P.', w / 2, 110)
    g.font = 'bold 30px Georgia, serif'
    text.split('\n').forEach((line, k) => g.fillText(line, w / 2, 170 + k * 38))
  })

const EPITAPHS = ['HARVARD\n1636–tonight', 'THE CRIMSON\nnever saw it\ncoming', 'HARVARD\nLAMPOON\nnot funny', 'CAMBRIDGE\nDREAMS', 'JOHN\nHARVARD\n(the statue)', 'SAFETY\nSCHOOL']

export default function Decor() {
  const M = useMemo(
    () => ({
      pumpkin: new THREE.MeshStandardMaterial({ color: '#d96a12', roughness: 0.65 }),
      stem: new THREE.MeshStandardMaterial({ color: '#4a5b22', roughness: 0.9 }),
      face: new THREE.MeshBasicMaterial({ map: faceTex(), transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(3, 1.9, 0.7) }),
      bulbO: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.75, 0.05), toneMapped: false }),
      bulbP: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.12, 2.3), toneMapped: false }),
      web: new THREE.MeshBasicMaterial({ map: webTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 }),
      spider: new THREE.MeshStandardMaterial({ color: '#0d0d0f', roughness: 0.5 }),
      thread: new THREE.MeshBasicMaterial({ color: '#cfcfd4', transparent: true, opacity: 0.5 }),
      bat: new THREE.MeshStandardMaterial({ color: '#141216', roughness: 0.7, side: THREE.DoubleSide }),
      ghost: new THREE.MeshStandardMaterial({ color: '#e9ecf2', roughness: 0.9, transparent: true, opacity: 0.82, side: THREE.DoubleSide, emissive: '#3b4252', emissiveIntensity: 0.6 }),
      eye: new THREE.MeshBasicMaterial({ color: '#050505' }),
      candle: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.6 }),
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.0, 0.6), toneMapped: false }),
    }),
    [],
  )

  // ---------- where everything goes (deterministic, so it's the same every visit)
  const layout = useMemo(() => {
    const pumpkins = [
      ...loopSpots(11, 2.1, 2).filter((p) => free(p.x, p.z)),
      ...loopSpots(13, -2.0, 7).filter((p) => free(p.x, p.z)),
    ].map((p) => ({ ...p, r: 0.2 + rand() * 0.16, turn: (rand() - 0.5) * 0.6 }))
    // string lights: anchors every 3 m along the outer wall under the ceiling, sagging between them
    const anchors = loopSpots(3, 2.3)
    const bulbs = []
    anchors.forEach((a, k) => {
      const b = anchors[(k + 1) % anchors.length]
      for (let j = 0; j < 5; j++) {
        const u = j / 5
        bulbs.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: H - 0.18 - Math.sin(u * Math.PI) * 0.32, purple: (k * 5 + j) % 2 === 1 })
      }
    })
    const webs = loopSpots(17, 2.45, 5).map((p) => ({ ...p, spider: rand() < 0.6, drop: 0.6 + rand() * 1.2 }))
    const ghosts = loopSpots(29, 0.4, 12).map((p) => ({ ...p, h: 2.6 + rand() * 0.5 }))
    const bats = Array.from({ length: 14 }, (_, k) => ({ i0: Math.floor(rand() * RING.length), speed: (0.7 + rand() * 0.8) * (rand() < 0.5 ? -1 : 1), y: 3.3 + rand() * 0.9, lane: (rand() - 0.5) * 3, phase: rand() * 10 }))
    const stones = []
    for (let k = 0; k < 40 && stones.length < EPITAPHS.length; k++) {
      const x = (rand() - 0.5) * 30
      const z = (rand() - 0.5) * 24
      if (inPoly(x, z, COURTYARD) && Math.hypot(x, z) > 3 && stones.every((s) => Math.hypot(s.x - x, s.z - z) > 3.5)) stones.push({ x, z, yaw: (rand() - 0.5) * 0.5, tilt: (rand() - 0.5) * 0.12, text: EPITAPHS[stones.length] })
    }
    return { pumpkins, bulbs, webs, ghosts, bats, stones }
  }, [])

  // ---------- pumpkins + bulbs: static instances
  const pumpkinGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 24, 16)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k)
      const ribs = 1 + 0.07 * Math.cos(Math.atan2(v.z, v.x) * 10) // the ridges
      p.setXYZ(k, v.x * ribs, v.y * 0.78, v.z * ribs)
    }
    g.computeVertexNormals()
    return g
  }, [])
  const pBody = useRef()
  const pStem = useRef()
  const pFace = useRef()
  const bulbsO = useRef()
  const bulbsP = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    layout.pumpkins.forEach((p, k) => {
      // face the middle of the hallway
      const yaw = Math.atan2(-p.nx, -p.nz) + p.turn
      q.setFromEuler(e.set(0, yaw, 0))
      m.compose(new THREE.Vector3(p.x, p.r * 0.78, p.z), q, new THREE.Vector3(p.r, p.r, p.r))
      pBody.current.setMatrixAt(k, m)
      m.compose(new THREE.Vector3(p.x, p.r * 1.5, p.z), q, new THREE.Vector3(p.r * 0.12, p.r * 0.5, p.r * 0.12))
      pStem.current.setMatrixAt(k, m)
      const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(p.r * 1.02)
      m.compose(new THREE.Vector3(p.x + f.x, p.r * 0.8, p.z + f.z), q, new THREE.Vector3(p.r * 1.5, p.r * 1.5, 1))
      pFace.current.setMatrixAt(k, m)
    })
    ;[bulbsO, bulbsP].forEach((ref, purple) => {
      let n = 0
      for (const b of layout.bulbs) {
        if (b.purple !== !!purple) continue
        m.compose(new THREE.Vector3(b.x, b.y, b.z), q.identity(), new THREE.Vector3(1, 1, 1))
        ref.current.setMatrixAt(n++, m)
      }
      ref.current.count = n
    })
    for (const r of [pBody, pStem, pFace, bulbsO, bulbsP]) r.current.instanceMatrix.needsUpdate = true
  }, [layout])

  // ---------- bats, spiders, ghosts: animated
  const batBody = useRef()
  const wingL = useRef()
  const wingR = useRef()
  const spiders = useRef([])
  const ghosts = useRef([])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), w: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const { m, w, q, e, p, s } = tmp
    layout.bats.forEach((b, k) => {
      // drift around the loop, bobbing, wings beating
      const f = (b.i0 + t * b.speed * 1.4) % RING.length
      const i = Math.floor((f + RING.length) % RING.length)
      const a = RING[i]
      const c = RING[(i + 1) % RING.length]
      const u = f - Math.floor(f)
      const x = a[0] + (c[0] - a[0]) * u
      const z = a[1] + (c[1] - a[1]) * u
      const yaw = Math.atan2((c[0] - a[0]) * Math.sign(b.speed), (c[1] - a[1]) * Math.sign(b.speed))
      const y = b.y + Math.sin(t * 2.3 + b.phase) * 0.25
      e.set(0, yaw, 0)
      q.setFromEuler(e)
      m.compose(p.set(x + Math.cos(yaw) * b.lane, y, z - Math.sin(yaw) * b.lane), q, s.set(0.05, 0.05, 0.11))
      batBody.current.setMatrixAt(k, m)
      const flap = Math.sin(t * 18 + b.phase) * 0.9
      for (const [ref, side] of [[wingL, 1], [wingR, -1]]) {
        e.set(0, yaw, side * flap)
        q.setFromEuler(e)
        w.compose(p.set(x + Math.cos(yaw) * b.lane, y, z - Math.sin(yaw) * b.lane), q, s.set(1, 1, 1))
        m.makeTranslation(side * 0.03, 0, 0)
        w.multiply(m)
        ref.current.setMatrixAt(k, w)
      }
    })
    for (const r of [batBody, wingL, wingR]) r.current.instanceMatrix.needsUpdate = true
    spiders.current.forEach((sp, k) => {
      if (!sp) return
      const web = layout.webs[k]
      const drop = web.drop * (0.75 + 0.25 * Math.sin(t * 0.7 + k))
      sp.position.y = H - 0.15 - drop
      sp.children[1].scale.y = drop
      sp.children[1].position.y = drop / 2
    })
    ghosts.current.forEach((g, k) => {
      if (!g) return
      g.rotation.z = Math.sin(t * 0.9 + k) * 0.12
      g.rotation.y = Math.sin(t * 0.4 + k * 2) * 0.5
    })
  })

  return (
    <group>
      <instancedMesh ref={pBody} args={[pumpkinGeo, M.pumpkin, layout.pumpkins.length]} castShadow />
      <instancedMesh ref={pStem} args={[STEM, M.stem, layout.pumpkins.length]} />
      <instancedMesh ref={pFace} args={[FACE, M.face, layout.pumpkins.length]} />
      <instancedMesh ref={bulbsO} args={[BULB, M.bulbO, layout.bulbs.length]} frustumCulled={false} />
      <instancedMesh ref={bulbsP} args={[BULB, M.bulbP, layout.bulbs.length]} frustumCulled={false} />
      <instancedMesh ref={batBody} args={[BAT_BODY, M.bat, layout.bats.length]} frustumCulled={false} />
      <instancedMesh ref={wingL} args={[WING_L, M.bat, layout.bats.length]} frustumCulled={false} />
      <instancedMesh ref={wingR} args={[WING_R, M.bat, layout.bats.length]} frustumCulled={false} />
      {/* cobwebs in the corner where the outer wall meets the ceiling, some with a spider on a thread */}
      {layout.webs.map((wb, k) => {
        const yaw = Math.atan2(wb.tx, wb.tz)
        return (
          <group key={k} position={[wb.x, 0, wb.z]}>
            <mesh material={M.web} position={[0, H - 0.75, 0]} rotation={[0, yaw, Math.PI]} scale={1.4}>
              <planeGeometry args={[1, 1]} />
            </mesh>
            {wb.spider && (
              <group ref={(el) => (spiders.current[k] = el)} position={[-wb.nx * 0.25, H - 1, -wb.nz * 0.25]}>
                <mesh material={M.spider} scale={[0.05, 0.04, 0.06]}>
                  <sphereGeometry args={[1, 10, 8]} />
                </mesh>
                <mesh material={M.thread}>
                  <cylinderGeometry args={[0.003, 0.003, 1, 4]} />
                </mesh>
              </group>
            )}
          </group>
        )
      })}
      {/* bedsheet ghosts hanging from the ceiling */}
      {layout.ghosts.map((g, k) => (
        <group key={k} position={[g.x, H, g.z]}>
          <group ref={(el) => (ghosts.current[k] = el)}>
            <mesh material={M.thread} position={[0, -0.25, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.5, 4]} />
            </mesh>
            <mesh material={M.ghost} position={[0, -0.72, 0]}>
              <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
            <mesh material={M.ghost} position={[0, -1.08, 0]}>
              <cylinderGeometry args={[0.22, 0.34, 0.72, 16, 1, true]} />
            </mesh>
            {[-0.07, 0.07].map((x) => (
              <mesh key={x} material={M.eye} position={[x, -0.78, 0.2]} scale={[1, 1.4, 0.4]}>
                <sphereGeometry args={[0.03, 8, 6]} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
      {/* the courtyard graveyard */}
      {layout.stones.map((st, k) => (
        <group key={k} position={[st.x, 0, st.z]} rotation={[st.tilt, st.yaw, 0]}>
          <mesh position={[0, 0.48, 0]} castShadow>
            <boxGeometry args={[0.62, 0.96, 0.14]} />
            <meshStandardMaterial attach="material-0" color="#5d5f63" roughness={0.95} />
            <meshStandardMaterial attach="material-1" color="#5d5f63" roughness={0.95} />
            <meshStandardMaterial attach="material-2" color="#5d5f63" roughness={0.95} />
            <meshStandardMaterial attach="material-3" color="#5d5f63" roughness={0.95} />
            <meshStandardMaterial attach="material-4" map={stoneTex(st.text)} emissiveMap={stoneTex(st.text)} emissive="#4a5a6a" roughness={0.95} />
            <meshStandardMaterial attach="material-5" color="#5d5f63" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.96, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.31, 0.31, 0.14, 20, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#5d5f63" roughness={0.95} />
          </mesh>
          {[-0.22, 0.25].map((x) => (
            <group key={x} position={[x, 0, 0.32]}>
              <mesh material={M.candle} position={[0, 0.09, 0]}>
                <cylinderGeometry args={[0.025, 0.025, 0.18, 10]} />
              </mesh>
              <mesh material={M.flame} position={[0, 0.2, 0]} scale={[1, 1.8, 1]}>
                <sphereGeometry args={[0.018, 8, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

const STEM = new THREE.CylinderGeometry(1, 0.7, 1, 6)
const FACE = new THREE.PlaneGeometry(1, 1)
const BULB = new THREE.SphereGeometry(0.035, 8, 6)
const BAT_BODY = new THREE.SphereGeometry(1, 8, 6)
// a bat wing: a scalloped triangle out to the side
const WING_L = (() => {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(0.22, 0.06)
  s.quadraticCurveTo(0.17, -0.02, 0.15, -0.06)
  s.quadraticCurveTo(0.08, -0.03, 0, -0.04)
  const g = new THREE.ShapeGeometry(s)
  g.rotateX(-Math.PI / 2)
  return g
})()
const WING_R = WING_L.clone().scale(-1, 1, 1)
