import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, BOX, CAP, CYL, SPH, ease, m, useConversation } from './avatarKit.jsx'

// Prof. Peter Schott: friendly, regular proportions, brown side-swept hair, a light-blue button-down and
// SoCal khakis. He holds a problem set so long it rolls out across the floor.
// He waves hello every few seconds; when you chat he turns to you and gestures while he answers.

const SKIN = '#f1c9a9'
const SKIN_SHADE = '#ddb08f'
const HAIR = '#6e4a2c'
const SHIRT = '#b7cfe9'
const SHIRT_LIGHT = '#cddcf0'
const KHAKI = '#c8b48a'
const SHOE = '#5a3a24'
const EYE = '#3f7cc0'
const V_TORSO = new THREE.CylinderGeometry(1, 0.86, 1, 28)

function pageTex(lines, header) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 1024
  const g = c.getContext('2d')
  g.fillStyle = '#fbfaf5'
  g.fillRect(0, 0, 256, 1024)
  g.fillStyle = '#1d2433'
  let y = 40
  if (header) {
    g.font = 'bold 26px Georgia, serif'
    g.fillText(header, 18, y)
    y += 40
  }
  g.font = '17px Georgia, serif'
  for (const n of lines) {
    g.fillStyle = '#1d2433'
    g.fillText(`${n}.`, 18, y)
    g.fillStyle = '#9aa3b2'
    for (let k = 0; k < 3; k++) g.fillRect(52, y - 10 + k * 14, 170 - k * 40, 4)
    y += 54
    if (y > 1000) break
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 })
}

function ProblemSet() {
  // hangs from his right fist to the floor, then keeps going… and going
  const [top, floor] = useMemo(
    () => [
      pageTex(Array.from({ length: 17 }, (_, i) => i + 1), 'PROBLEM SET 1'),
      pageTex(Array.from({ length: 19 }, (_, i) => i + 18)),
    ],
    [],
  )
  return (
    <group position={[-0.27, 0, 0.3]}>
      <B g={CYL} c="#8a5a33" p={[0, 1.04, 0]} r={[0, 0, Math.PI / 2]} s={[0.022, 0.3, 0.022]} />
      <mesh material={top} position={[0, 0.52, 0]}>
        <planeGeometry args={[0.26, 1.04]} />
      </mesh>
      <mesh material={floor} position={[0, 0.004, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.26, 1.24]} />
      </mesh>
      <B g={CYL} c="#8a5a33" p={[0, 0.024, 1.25]} r={[0, 0, Math.PI / 2]} s={[0.024, 0.3, 0.024]} />
      <B g={CYL} c="#fbfaf5" p={[0, 0.024, 1.25]} r={[0, 0, Math.PI / 2]} s={[0.05, 0.27, 0.05]} />
    </group>
  )
}

function Head({ mouth }) {
  return (
    <>
      {/* head, a gentle jawline, ears */}
      <B c={SKIN} p={[0, 0.14, 0]} s={[0.105, 0.128, 0.11]} />
      <B c={SKIN} p={[0, 0.075, 0.012]} s={[0.088, 0.07, 0.09]} />
      {[-1, 1].map((sx) => (
        <B key={sx} c={SKIN} p={[0.104 * sx, 0.14, 0]} s={[0.018, 0.035, 0.022]} />
      ))}
      {/* brows, blue eyes, nose */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={BOX} c={HAIR} p={[0.04 * sx, 0.188, 0.1]} r={[0, 0, -0.08 * sx]} s={[0.034, 0.008, 0.008]} />
          <B c="#ffffff" p={[0.038 * sx, 0.163, 0.096]} s={[0.017, 0.011, 0.009]} />
          <B c={EYE} p={[0.038 * sx, 0.163, 0.102]} s={[0.008, 0.009, 0.005]} />
          <B c="#111" p={[0.038 * sx, 0.163, 0.105]} s={[0.004, 0.0045, 0.003]} />
        </group>
      ))}
      <B c={SKIN_SHADE} p={[0, 0.128, 0.108]} r={[0.3, 0, 0]} s={[0.014, 0.03, 0.02]} />
      {/* friendly smile; the mouth group scales open while he talks */}
      <group ref={mouth} position={[0, 0.082, 0.1]} scale={[1, 0.012, 1]}>
        <B g={BOX} c="#7a3b34" s={[0.05, 1, 0.01]} />
      </group>
      {[-1, 1].map((sx) => (
        <B key={sx} g={BOX} c="#7a3b34" p={[0.028 * sx, 0.087, 0.097]} r={[0, 0, 0.45 * sx]} s={[0.012, 0.005, 0.007]} />
      ))}
      {/* brown hair, side part, swept across */}
      <B c={HAIR} p={[0, 0.21, -0.008]} s={[0.111, 0.065, 0.116]} />
      <B c={HAIR} p={[0.02, 0.235, 0.05]} r={[0.3, 0, -0.3]} s={[0.085, 0.032, 0.055]} />
      <B c={HAIR} p={[0, 0.16, -0.065]} s={[0.105, 0.09, 0.055]} />
      {[-1, 1].map((sx) => (
        <B key={sx} g={BOX} c={HAIR} p={[0.1 * sx, 0.18, -0.01]} s={[0.012, 0.05, 0.08]} />
      ))}
    </>
  )
}

export default function Schott({ position = [0, 0, 0], rotation = 0 }) {
  const root = useRef()
  const head = useRef()
  const mouth = useRef()
  const waveArm = useRef()
  const conv = useConversation('schott', root, head, { rotation, eyeHeight: 1.88, scan: 0.3 })

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const { talking, speaking } = conv.current
    // upbeat: a little bounce, a friendly wave every six seconds, nods along while you talk
    root.current.position.y = talking ? 0 : Math.abs(Math.sin(t * 1.8)) * 0.012
    const waving = !talking && t % 6 < 1.8
    const a = waveArm.current
    if (speaking) {
      a.rotation.x = ease(a.rotation.x, -0.9 + Math.sin(t * 4) * 0.3, Math.min(1, dt * 8))
      a.rotation.z = ease(a.rotation.z, 0.25, Math.min(1, dt * 8))
    } else if (waving) {
      a.rotation.x = ease(a.rotation.x, -0.2, Math.min(1, dt * 8))
      a.rotation.z = ease(a.rotation.z, 2.5 + Math.sin(t * 9) * 0.3, Math.min(1, dt * 8))
    } else {
      a.rotation.x = ease(a.rotation.x, 0.05, Math.min(1, dt * 5))
      a.rotation.z = ease(a.rotation.z, 0.12, Math.min(1, dt * 5))
    }
    head.current.rotation.z = talking && !speaking ? Math.sin(t * 2.2) * 0.05 : Math.sin(t * 0.9) * 0.03
    mouth.current.scale.y = speaking ? 0.01 + Math.abs(Math.sin(t * 12)) * 0.03 : 0.012
  })

  const sleeve = m(SHIRT)
  const hand = m(SKIN)
  const arm = (
    <>
      <mesh geometry={CAP} material={sleeve} position={[0, -0.22, 0]} scale={[0.075, 0.19, 0.075]} />
      <B g={CYL} c={SHIRT_LIGHT} p={[0, -0.43, 0]} s={[0.062, 0.04, 0.062]} />
      <mesh geometry={SPH} material={hand} position={[0, -0.5, 0.02]} scale={[0.048, 0.058, 0.044]} />
    </>
  )
  return (
    <>
      <group position={position}>
        <group ref={root} rotation={[0, rotation, 0]}>
          {/* loafers + khakis + belt */}
          {[-1, 1].map((sx) => (
            <group key={sx}>
              <B g={BOX} c={SHOE} p={[0.1 * sx, 0.045, 0.05]} s={[0.11, 0.09, 0.28]} />
              <B g={CYL} c={KHAKI} p={[0.1 * sx, 0.5, 0]} s={[0.082, 0.82, 0.082]} />
            </group>
          ))}
          <B g={CYL} c={KHAKI} p={[0, 0.88, 0]} s={[0.195, 0.1, 0.155]} />
          <B g={CYL} c="#4a3020" p={[0, 0.935, 0]} s={[0.2, 0.04, 0.16]} />
          <B g={BOX} c="#c9ccd2" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, 0.935, 0.16]} s={[0.04, 0.03, 0.01]} />

          {/* light-blue button-down on a V-shaped torso */}
          <mesh geometry={V_TORSO} material={m(SHIRT)} position={[0, 1.24, 0]} scale={[0.235, 0.6, 0.16]} />
          <B c={SHIRT} p={[0, 1.53, 0]} s={[0.27, 0.085, 0.16]} />
          {[0.98, 1.08, 1.18, 1.28, 1.38].map((y) => (
            <B key={y} c="#f4f6fa" p={[0, y, 0.137 + ((y - 0.94) / 0.6) * 0.037]} s={[0.008, 0.008, 0.004]} />
          ))}
          <B g={BOX} c={SKIN} p={[0, 1.52, 0.155]} r={[0, 0, Math.PI / 4]} s={[0.055, 0.055, 0.01]} />
          {[-1, 1].map((sx) => (
            <B key={sx} g={BOX} c={SHIRT_LIGHT} p={[0.055 * sx, 1.585, 0.1]} r={[0.35, 0, 0.55 * sx]} s={[0.085, 0.045, 0.012]} />
          ))}
          <B g={CYL} c={SKIN} p={[0, 1.63, 0]} s={[0.05, 0.14, 0.05]} />

          {/* left arm waves; right arm holds out the (very long) problem set */}
          <group ref={waveArm} position={[0.27, 1.5, 0]} rotation={[0.05, 0, 0.12]}>
            {arm}
          </group>
          <group position={[-0.25, 1.47, 0]} rotation={[-0.5, 0, 0]}>
            {arm}
          </group>
          <ProblemSet />

          <group ref={head} position={[0, 1.7, 0]}>
            <Head mouth={mouth} />
          </group>
        </group>
      </group>
    </>
  )
}
