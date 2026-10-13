import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Handsome Dan, Yale's bulldog, your companion in the fight. Rivals.jsx moves him by writing to DAN;
// this component just draws him there: trotting, biting, turning to look at you, and glowing gold once he
// reaches his top level. Fur texture and natural cream/fawn coloring, Yale-blue bandana.

export const DAN = { x: -24.4, z: 20.5, yaw: 0, moving: false, biting: false, golden: false }

function bandanaTex() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#00356b'
  g.fillRect(0, 0, 256, 256)
  g.fillStyle = '#ffffff'
  g.font = 'bold 120px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('Y', 128, 175)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function furTex() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#808080'
  g.fillRect(0, 0, 256, 256)
  let s = 5
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 5000; i++) {
    const v = Math.floor(90 + r() * 90)
    g.strokeStyle = `rgba(${v},${v},${v},0.5)`
    g.lineWidth = 0.8
    const x = r() * 256
    const y = r() * 256
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (r() - 0.5) * 3, y + 4 + r() * 5) // short hairs, combed one way
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  return t
}
function glowTex() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, '#ffffff')
  r.addColorStop(0.25, '#ffe27a')
  r.addColorStop(1, 'rgba(255,190,40,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const SPH = new THREE.SphereGeometry(1, 28, 20)
const SPH_S = new THREE.SphereGeometry(1, 16, 12)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18)
const BANDANA = (() => {
  const g = new THREE.BufferGeometry()
  // triangle hanging from the neck, point down
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.17, 0.08, 0, 0.17, 0.08, 0, 0, -0.17, 0.02], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2))
  g.computeVertexNormals()
  return g
})()

const FUR = furTex()
const fur = (color) => new THREE.MeshStandardMaterial({ color, map: FUR, bumpMap: FUR, bumpScale: 1.5, roughness: 0.95 })
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o })
const M = {
  coat: fur('#e9e1d3'), // warm cream
  patch: fur('#b4875c'), // fawn
  ear: fur('#5b4535'),
  mouth: mat('#7e4a46', { roughness: 0.6 }),
  tooth: mat('#efe8da', { roughness: 0.35 }),
  eye: mat('#0d0907', { roughness: 0.08 }),
  bandana: new THREE.MeshStandardMaterial({ map: bandanaTex(), roughness: 1, side: THREE.DoubleSide, color: '#c9ced8' }),
}
const GOLD = new THREE.Color('#ffc93a')
const CREAM = new THREE.Color('#e9e1d3')
const FAWN = new THREE.Color('#b4875c')

const B = ({ g = SPH, m, p, s, r = [0, 0, 0] }) => <mesh geometry={g} material={m} position={p} scale={s} rotation={r} castShadow />
const LEGS = [[-0.15, 0.22], [0.15, 0.22], [-0.13, -0.22], [0.13, -0.22]]
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

export default function HandsomeDan() {
  const { camera } = useThree()
  const root = useRef()
  const body = useRef()
  const head = useRef()
  const tail = useRef()
  const legs = useRef([])
  const halo = useRef()
  const haloMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), [])
  const look = useRef(0)

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    root.current.position.set(DAN.x, 0, DAN.z)
    root.current.rotation.y += wrap(DAN.yaw - root.current.rotation.y) * Math.min(1, dt * 10)
    const moving = DAN.moving
    // head: chomps when biting, glances back at you now and then while standing
    const toYou = wrap(Math.atan2(camera.position.x - DAN.x, camera.position.z - DAN.z) - root.current.rotation.y)
    const want = DAN.biting ? 0 : moving ? Math.sin(t * 2) * 0.1 : Math.max(-1, Math.min(1, toYou)) * (Math.sin(t * 0.4) > 0 ? 1 : 0.3)
    look.current += (want - look.current) * Math.min(1, dt * 6)
    head.current.rotation.set(DAN.biting ? 0.25 + Math.sin(t * 22) * 0.25 : 0, look.current, 0)
    body.current.position.y = DAN.biting ? Math.abs(Math.sin(t * 14)) * 0.04 : moving ? Math.abs(Math.sin(t * 12)) * 0.02 : 0
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = moving ? Math.sin(t * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.5 : 0
    })
    tail.current.rotation.z = Math.sin(t * (moving ? 10 : 18)) * 0.6
    // golden at his top level
    M.coat.color.lerp(DAN.golden ? GOLD : CREAM, Math.min(1, dt * 3))
    M.patch.color.lerp(DAN.golden ? GOLD : FAWN, Math.min(1, dt * 3))
    halo.current.visible = DAN.golden
    halo.current.position.set(DAN.x, 1.05 + Math.sin(t * 3) * 0.05, DAN.z)
    halo.current.scale.setScalar(0.55 + Math.sin(t * 5) * 0.12)
  })

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          {/* stocky body with fawn patches, Yale bandana */}
          <B m={M.coat} p={[0, 0.36, 0]} s={[0.21, 0.19, 0.33]} />
          <B m={M.patch} p={[0.1, 0.42, -0.12]} s={[0.12, 0.1, 0.15]} />
          <B m={M.patch} p={[-0.12, 0.33, -0.2]} s={[0.1, 0.1, 0.1]} />
          <B m={M.coat} p={[0, 0.4, 0.2]} s={[0.24, 0.2, 0.18]} />
          <mesh geometry={BANDANA} material={M.bandana} position={[0, 0.47, 0.35]} rotation={[-0.25, 0, 0]} />
          <B g={CYL} m={M.bandana} p={[0, 0.55, 0.3]} s={[0.2, 0.05, 0.12]} />
          {/* legs: front pair wide-set like a bulldog */}
          {LEGS.map(([lx, lz], k) => (
            <group key={k} ref={(el) => (legs.current[k] = el)} position={[lx, 0.3, lz]}>
              <B g={CYL} m={M.coat} p={[0, -0.13, 0]} s={[0.055, 0.26, 0.055]} />
              <B g={SPH_S} m={M.coat} p={[0, -0.27, 0.03]} s={[0.06, 0.03, 0.08]} />
            </group>
          ))}
          <group ref={tail} position={[0, 0.45, -0.33]}>
            <B g={SPH_S} m={M.coat} p={[0, 0.03, -0.02]} s={[0.035, 0.05, 0.035]} />
          </group>
          {/* big bulldog head with an underbite */}
          <group ref={head} position={[0, 0.6, 0.36]}>
            <B m={M.coat} s={[0.2, 0.17, 0.16]} />
            <B g={SPH_S} m={M.patch} p={[0.08, 0.05, 0.06]} s={[0.09, 0.09, 0.1]} />
            {[-1, 1].map((sx) => (
              <group key={sx}>
                <B g={SPH_S} m={M.ear} p={[0.16 * sx, 0.11, -0.02]} r={[0, 0, 0.6 * sx]} s={[0.07, 0.04, 0.05]} />
                <B g={SPH_S} m={M.eye} p={[0.07 * sx, 0.05, 0.13]} s={[0.032, 0.03, 0.02]} />
                <B m={M.coat} p={[0.075 * sx, -0.05, 0.12]} s={[0.075, 0.07, 0.07]} />
                <B g={SPH_S} m={M.tooth} p={[0.06 * sx, -0.06, 0.17]} s={[0.012, 0.022, 0.01]} />
              </group>
            ))}
            <B g={SPH_S} m={M.eye} p={[0, 0, 0.17]} s={[0.05, 0.035, 0.03]} />
            <B g={SPH_S} m={M.mouth} p={[0, -0.1, 0.11]} s={[0.13, 0.05, 0.08]} />
            <B g={SPH_S} m={M.ear} p={[0, -0.03, 0.16]} s={[0.12, 0.02, 0.03]} />
          </group>
        </group>
      </group>
      <sprite ref={halo} material={haloMat} visible={false} />
    </>
  )
}
