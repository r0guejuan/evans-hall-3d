import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { B, BOX, CAP, CYL, SPH, TORSO, TORUS, m } from './avatarKit.jsx'
import { RIVALS } from './Rivals.jsx'
import { HEROES } from './weapons.js'

// The Deans you can hire at Admissions (logic in Rivals.jsx, stats in weapons.js). Each is drawn from
// primitives like the professors, faces +z, walks when moving, punches when fighting, and wears a small
// floating name tag so you can find them in a fight.

function tagTex(text) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(10,10,14,0.75)'
  g.beginPath()
  g.roundRect(8, 8, 496, 80, 40)
  g.fill()
  g.fillStyle = '#ffd76a'
  g.font = 'bold 44px system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 50)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ---------- Assistant Dean Wendy Tsung: dark shoulder-length bob with side-swept bangs, pearl earrings,
// a fine silver necklace, a navy top
function Tsung({ legL, legR, armL, armR }) {
  const SKIN = '#e9c6a8'
  const HAIR = '#16110f'
  const TOP = '#1f2a44'
  const PANTS = '#23262d'
  const arm = (
    <>
      <mesh geometry={CAP} material={m(TOP)} position={[0, -0.2, 0]} scale={[0.058, 0.17, 0.058]} />
      <B c={SKIN} p={[0, -0.46, 0.01]} s={[0.04, 0.05, 0.038]} />
    </>
  )
  return (
    <>
      {[
        [legL, 0.085],
        [legR, -0.085],
      ].map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 0.86, 0]}>
          <B g={CYL} c={PANTS} p={[0, -0.42, 0]} s={[0.07, 0.84, 0.07]} />
          <B g={BOX} c="#111" p={[0, -0.83, 0.04]} s={[0.085, 0.06, 0.22]} />
        </group>
      ))}
      <mesh geometry={TORSO} material={m(TOP)} position={[0, 1.14, 0]} scale={[0.19, 0.56, 0.13]} />
      <B c={TOP} p={[0, 1.4, 0]} s={[0.22, 0.07, 0.13]} />
      <B g={CYL} c={SKIN} p={[0, 1.47, 0]} s={[0.045, 0.1, 0.045]} />
      {/* necklace */}
      <mesh geometry={TORUS} material={m('#d9dde3', { metalness: 0.9, roughness: 0.2 })} position={[0, 1.43, 0.035]} rotation={[1.25, 0, 0]} scale={[0.06, 0.06, 0.05]} />
      <group ref={armL} position={[0.22, 1.38, 0]}>
        {arm}
      </group>
      <group ref={armR} position={[-0.22, 1.38, 0]}>
        {arm}
      </group>
      <group position={[0, 1.52, 0]}>
        <B c={SKIN} p={[0, 0.12, 0]} s={[0.095, 0.118, 0.1]} />
        {/* eyes, brows, warm smile */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B c="#1a1210" p={[0.034 * sx, 0.135, 0.09]} s={[0.012, 0.008, 0.006]} />
            <B g={BOX} c={HAIR} p={[0.035 * sx, 0.158, 0.092]} r={[0, 0, -0.1 * sx]} s={[0.03, 0.006, 0.006]} />
            {/* pearl earrings */}
            <B c="#f6f3ea" o={{ roughness: 0.25 }} p={[0.097 * sx, 0.085, 0.01]} s={[0.012, 0.012, 0.012]} />
          </group>
        ))}
        <B g={BOX} c="#b8484f" p={[0, 0.075, 0.092]} s={[0.04, 0.008, 0.006]} />
        <B c="#d9ad90" p={[0, 0.108, 0.098]} s={[0.012, 0.022, 0.012]} />
        {/* the bob: crown, sides to the jaw, back, and side-swept bangs */}
        <B c={HAIR} p={[0, 0.19, -0.01]} s={[0.108, 0.07, 0.112]} />
        {[-1, 1].map((sx) => (
          <B key={sx} c={HAIR} p={[0.088 * sx, 0.1, -0.005]} s={[0.035, 0.1, 0.095]} />
        ))}
        <B c={HAIR} p={[0, 0.1, -0.06]} s={[0.105, 0.11, 0.065]} />
        <B c={HAIR} p={[-0.025, 0.2, 0.07]} r={[0.5, 0, 0.45]} s={[0.085, 0.03, 0.05]} />
      </group>
    </>
  )
}

// ---------- Dean Kerwin Charles: close-cropped hair, dark rectangular glasses, navy suit, white shirt,
// lavender patterned tie
function Charles({ legL, legR, armL, armR }) {
  const SKIN = '#5b3a27'
  const SUIT = '#2a3a5c'
  const LAPEL = '#22304d'
  const arm = (
    <>
      <mesh geometry={CAP} material={m(SUIT)} position={[0, -0.21, 0]} scale={[0.068, 0.18, 0.068]} />
      <B g={CYL} c="#f4f5f7" p={[0, -0.41, 0]} s={[0.055, 0.03, 0.055]} />
      <B c={SKIN} p={[0, -0.48, 0.01]} s={[0.046, 0.056, 0.043]} />
    </>
  )
  const frame = m('#141414', { roughness: 0.3 })
  return (
    <>
      {[
        [legL, 0.095],
        [legR, -0.095],
      ].map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 0.92, 0]}>
          <B g={CYL} c={SUIT} p={[0, -0.45, 0]} s={[0.08, 0.9, 0.08]} />
          <B g={BOX} c="#0e0e0e" p={[0, -0.89, 0.045]} s={[0.1, 0.07, 0.27]} />
        </group>
      ))}
      <mesh geometry={TORSO} material={m(SUIT)} position={[0, 1.22, 0]} scale={[0.24, 0.6, 0.155]} />
      <B c={SUIT} p={[0, 1.5, 0]} s={[0.27, 0.08, 0.155]} />
      {/* white shirt, lavender tie, lapels */}
      <B g={BOX} c="#f4f5f7" p={[0, 1.4, 0.138]} r={[0.1, 0, 0]} s={[0.1, 0.2, 0.01]} />
      <B g={BOX} c="#b6a4d4" p={[0, 1.36, 0.146]} s={[0.035, 0.22, 0.008]} />
      <B g={BOX} c="#9a86bd" p={[0, 1.465, 0.146]} s={[0.04, 0.03, 0.01]} />
      {[-1, 1].map((sx) => (
        <B key={sx} g={BOX} c={LAPEL} p={[0.07 * sx, 1.38, 0.14]} r={[0.1, 0, 0.32 * sx]} s={[0.05, 0.24, 0.012]} />
      ))}
      <B g={CYL} c={SKIN} p={[0, 1.58, 0]} s={[0.055, 0.12, 0.055]} />
      <group ref={armL} position={[0.27, 1.47, 0]}>
        {arm}
      </group>
      <group ref={armR} position={[-0.27, 1.47, 0]}>
        {arm}
      </group>
      <group position={[0, 1.64, 0]}>
        <B c={SKIN} p={[0, 0.12, 0]} s={[0.104, 0.125, 0.108]} />
        {[-1, 1].map((sx) => (
          <B key={sx} c={SKIN} p={[0.104 * sx, 0.12, 0]} s={[0.018, 0.034, 0.022]} />
        ))}
        {/* close-cropped hair */}
        <B c="#151110" p={[0, 0.165, -0.012]} s={[0.106, 0.09, 0.108]} />
        <B c={SKIN} p={[0, 0.13, 0.03]} s={[0.1, 0.105, 0.09]} />
        {/* eyes behind dark rectangular glasses */}
        {[-1, 1].map((sx) => (
          <group key={sx}>
            <B c="#f4f1ea" p={[0.038 * sx, 0.135, 0.094]} s={[0.017, 0.011, 0.008]} />
            <B c="#0d0a08" p={[0.038 * sx, 0.135, 0.1]} s={[0.009, 0.008, 0.005]} />
            <B g={BOX} c="#141414" p={[0.038 * sx, 0.157, 0.104]} s={[0.05, 0.007, 0.006]} />
            <B g={BOX} c="#141414" p={[0.038 * sx, 0.115, 0.104]} s={[0.05, 0.006, 0.006]} />
            <B g={BOX} c="#141414" p={[0.063 * sx, 0.136, 0.104]} s={[0.006, 0.046, 0.006]} />
            <B g={BOX} c="#141414" p={[0.013 * sx, 0.136, 0.106]} s={[0.006, 0.046, 0.006]} />
            <mesh geometry={BOX} material={frame} position={[0.098 * sx, 0.15, 0.04]} scale={[0.005, 0.006, 0.12]} />
          </group>
        ))}
        <B g={BOX} c="#141414" p={[0, 0.148, 0.108]} s={[0.022, 0.005, 0.005]} />
        <B c="#4a2e1e" p={[0, 0.103, 0.104]} s={[0.018, 0.022, 0.014]} />
        {/* big smile */}
        <B g={BOX} c="#f2efe9" p={[0, 0.068, 0.1]} s={[0.05, 0.012, 0.006]} />
        {[-1, 1].map((sx) => (
          <B key={sx} g={BOX} c="#3e2618" p={[0.03 * sx, 0.073, 0.098]} r={[0, 0, 0.5 * sx]} s={[0.014, 0.005, 0.006]} />
        ))}
      </group>
    </>
  )
}

function Hero({ id, Body, tagY }) {
  const root = useRef()
  const legL = useRef()
  const legR = useRef()
  const armL = useRef()
  const armR = useRef()
  const tag = useMemo(() => tagTex(HEROES[id].short), [id])
  useFrame(({ clock }, dt) => {
    const h = RIVALS.heroes[id]
    root.current.visible = !!h.on
    if (!h.on) return
    const t = clock.elapsedTime
    // face where they're going (or who they're punching)
    const look = h.attacking && h.target ? Math.atan2(h.target.x - h.x, h.target.z - h.z) : h.moving ? h.yaw : h.yaw
    root.current.position.set(h.x + (h.flash > 0 ? (Math.random() - 0.5) * 0.05 : 0), h.y, h.z)
    root.current.rotation.set(h.down ? -Math.min(1, h.downT * 2) * (Math.PI / 2) : 0, look, 0)
    const swing = h.moving && !h.down ? Math.sin(t * 9 + h.phase) * 0.5 : 0
    legL.current.rotation.x = swing
    legR.current.rotation.x = -swing
    armL.current.rotation.x = h.attacking ? -1.1 : -swing * 0.6
    armR.current.rotation.x = h.attacking ? -1.5 + Math.max(0, Math.sin(t * 9)) * -0.25 : swing * 0.6
    root.current.children.at(-1).position.y = tagY + Math.sin(t * 2) * 0.03
  })
  return (
    <group ref={root} visible={false}>
      <Body legL={legL} legR={legR} armL={armL} armR={armR} />
      {/* a soft light over their head, so you can see them in the dark (and find them in a fight) */}
      <pointLight position={[0, 2.6, 0.8]} color="#fff1dc" intensity={2.2} distance={4} decay={1.5} />
      <sprite position={[0, tagY, 0]} scale={[0.75, 0.14, 1]}>
        <spriteMaterial map={tag} transparent depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

export default function Heroes() {
  return (
    <>
      <Hero id="tsung" Body={Tsung} tagY={2.0} />
      <Hero id="charles" Body={Charles} tagY={2.15} />
    </>
  )
}
