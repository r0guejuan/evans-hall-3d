import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Labubu from './Labubu.jsx'
import { chat } from './chat.js'
import { B, BOX, CAP, CYL, SPH, TORSO, TORUS, ease, m, useConversation } from './avatarKit.jsx'

// where Zaman stands (the Labubu thieves head here)
export const ZAMAN = { x: 0, z: 0, ready: false }
const _wp = new THREE.Vector3()

// Prof. Tauhid Zaman: bald, glasses, black BLACKPINK hoodie, joggers, pink-soled sneakers, a Labubu
// dangling off his belt loop, and a hot-pink chainsaw he holds up while he waits.
// Faces +z like the other professors; his right hand (chainsaw) is at -x.
// When you talk to him he turns to face you, looks up at you, and his mouth moves while he answers.

const SKIN = '#b98260' // light brown
const HAIR = '#141016'
const HOODIE = '#151317'
const HOODIE_DARK = '#0b0a0c'
const PINK = '#ff4fa3'
const PANTS = '#2b2f38'
const SHOE = '#f4f1ec'

let logoMat
function hoodieLogo() {
  if (logoMat) return logoMat
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#f7a8cf'
  g.font = '900 88px "Arial Black", Impact, system-ui, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('BLACKPINK', 256, 68, 490)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  logoMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })
  return logoMat
}

const TEETH = 9
const BAR_TOP = -0.2
const BAR_LEN = 0.42

function Chainsaw() {
  // gripped by the rear handle, guide bar pointing down the arm (-y), so raising the arm raises the bar.
  // The chain runs while he's idling and stops when you talk to him.
  const root = useRef()
  const front = useRef()
  const back = useRef()
  const offset = useRef(0)
  useFrame((_, dt) => {
    const running = chat.get().talkingTo !== 'zaman'
    if (running) offset.current = (offset.current + Math.min(dt, 0.05) * 0.9) % 1
    root.current.position.x = running ? Math.sin(performance.now() * 0.09) * 0.002 : 0 // engine rumble
    const step = BAR_LEN / TEETH
    for (let i = 0; i < TEETH; i++) {
      const k = ((i / TEETH + offset.current) % 1) * BAR_LEN
      front.current.children[i].position.y = BAR_TOP - k // chain runs out along the front edge…
      back.current.children[i].position.y = BAR_TOP - BAR_LEN + k + step * 0.5 // …and back along the rear
    }
  })
  const teeth = (ref, z) => (
    <group ref={ref}>
      {Array.from({ length: TEETH }, (_, i) => (
        <B key={i} g={BOX} c="#d8dce2" o={{ metalness: 0.8, roughness: 0.3 }} p={[0, BAR_TOP - i * 0.04, z]} s={[0.02, 0.014, 0.014]} />
      ))}
    </group>
  )
  return (
    // turned so the flat of the blade faces the room, and a bit oversized so it reads from the seats
    <group ref={root} position={[0, -0.5, 0.02]} rotation={[0, Math.PI / 2, 0]} scale={1.3}>
      {/* rear handle loop around his fist */}
      <B g={TORUS} c="#111" r={[0, Math.PI / 2, 0]} s={[0.065, 0.065, 0.065]} />
      {/* engine housing: hot pink, obviously */}
      <B g={BOX} c={PINK} p={[0, -0.12, 0]} s={[0.09, 0.15, 0.17]} />
      <B g={BOX} c="#111" p={[0, -0.09, -0.035]} s={[0.093, 0.06, 0.1]} />
      <B g={CYL} c="#111" p={[0.055, -0.13, -0.03]} r={[0, 0, Math.PI / 2]} s={[0.018, 0.02, 0.018]} />
      <B g={BOX} c="#111" p={[0, BAR_TOP - 0.01, 0.02]} s={[0.1, 0.012, 0.11]} />
      {/* guide bar + chain + rounded tip */}
      <B g={BOX} c="#26262b" p={[0, BAR_TOP - BAR_LEN / 2, 0.02]} s={[0.018, BAR_LEN, 0.084]} />
      <B g={BOX} c="#aeb3bb" o={{ metalness: 0.85, roughness: 0.3 }} p={[0, BAR_TOP - BAR_LEN / 2, 0.02]} s={[0.021, BAR_LEN, 0.064]} />
      <B g={CYL} c="#26262b" p={[0, BAR_TOP - BAR_LEN, 0.02]} r={[0, 0, Math.PI / 2]} s={[0.042, 0.018, 0.042]} />
      {teeth(front, 0.064)}
      {teeth(back, -0.024)}
    </group>
  )
}

function Head({ mouth }) {
  return (
    <>
      {/* bald head, a little glossy so it catches the classroom lights */}
      <B c={SKIN} o={{ roughness: 0.5 }} p={[0, 0.13, 0]} s={[0.11, 0.13, 0.12]} />
      {[-1, 1].map((sx) => (
        <B key={sx} c={SKIN} p={[0.112 * sx, 0.13, 0]} s={[0.02, 0.034, 0.02]} />
      ))}
      {/* eyes, brows, nose */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B c="#ffffff" p={[0.042 * sx, 0.152, 0.104]} s={[0.019, 0.016, 0.01]} />
          <B c="#24160f" p={[0.042 * sx, 0.152, 0.112]} s={[0.01, 0.011, 0.006]} />
          <B g={BOX} c={HAIR} p={[0.044 * sx, 0.188, 0.11]} r={[0, 0, -0.08 * sx]} s={[0.04, 0.009, 0.01]} />
        </group>
      ))}
      <B c={SKIN} p={[0, 0.122, 0.122]} s={[0.019, 0.028, 0.022]} />
      {/* MIT-nerd glasses */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={TORUS} c="#0d0d0f" p={[0.044 * sx, 0.153, 0.118]} s={[0.034, 0.027, 0.03]} />
          <B g={BOX} c="#0d0d0f" p={[0.1 * sx, 0.16, 0.06]} r={[0, Math.PI / 2, 0]} s={[0.11, 0.006, 0.006]} />
        </group>
      ))}
      <B g={BOX} c="#0d0d0f" p={[0, 0.157, 0.121]} s={[0.02, 0.006, 0.006]} />
      {/* smile; the mouth group scales open while he talks */}
      <group ref={mouth} position={[0, 0.085, 0.111]} scale={[1, 0.009, 1]}>
        <B g={BOX} c="#5b2420" s={[0.05, 1, 0.01]} />
      </group>
      <B c={SKIN} p={[0.026, 0.09, 0.112]} s={[0.006, 0.006, 0.004]} />
      <B c={SKIN} p={[-0.026, 0.09, 0.112]} s={[0.006, 0.006, 0.004]} />
    </>
  )
}

export default function Zaman({ position = [0, 0, 0], rotation = 0 }) {
  const root = useRef()
  const head = useRef()
  const mouth = useRef()
  const sawArm = useRef()
  const otherArm = useRef()
  const charm = useRef()
  const conv = useConversation('zaman', root, head, { rotation })

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const t = clock.elapsedTime
    const { talking, speaking } = conv.current
    root.current.position.y = position[1] + (talking ? 0 : Math.abs(Math.sin(t * 2.4)) * 0.015) // vibing to the music
    head.current.rotation.z = talking ? Math.sin(t * 1.3) * 0.04 : Math.sin(t * 2.4) * 0.05

    // chainsaw: held up and swaying when idle, lowered to his side (chain stopped) while talking
    const sa = sawArm.current
    const ax = talking ? -0.2 + (speaking ? Math.sin(t * 5) * 0.15 : 0) : -2.65 + Math.sin(t * 2.4) * 0.2
    const az = talking ? -0.2 : -0.12 + Math.sin(t * 1.2) * 0.22
    sa.rotation.x = ease(sa.rotation.x, ax, Math.min(1, dt * 6))
    sa.rotation.z = ease(sa.rotation.z, az, Math.min(1, dt * 6))
    otherArm.current.rotation.x = speaking ? -0.35 + Math.sin(t * 4 + 1) * 0.25 : ease(otherArm.current.rotation.x, 0.05, Math.min(1, dt * 4))

    mouth.current.scale.y = speaking ? 0.008 + Math.abs(Math.sin(t * 13)) * 0.026 : 0.009
    charm.current.rotation.z = Math.sin(t * 2.4) * 0.22
    charm.current.visible = !chat.get().labubuStolen // Harvard took it
    root.current.getWorldPosition(_wp)
    ZAMAN.x = _wp.x
    ZAMAN.z = _wp.z
    ZAMAN.ready = true
    charm.current.rotation.x = Math.sin(t * 1.7) * 0.12
  })

  const sleeve = m(HOODIE)
  const hand = m(SKIN)
  const arm = (
    <>
      <mesh geometry={CAP} material={sleeve} position={[0, -0.22, 0]} scale={[0.068, 0.19, 0.068]} />
      <B g={CYL} c={HOODIE_DARK} p={[0, -0.43, 0]} s={[0.058, 0.05, 0.058]} />
      <mesh geometry={SPH} material={hand} position={[0, -0.5, 0.02]} scale={[0.045, 0.055, 0.042]} />
    </>
  )

  return (
    <group ref={root} position={position} rotation={[0, rotation, 0]}>
      {/* sneakers with pink soles + joggers */}
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={BOX} c={SHOE} p={[0.1 * sx, 0.055, 0.04]} s={[0.11, 0.08, 0.27]} />
          <B g={BOX} c={PINK} p={[0.1 * sx, 0.012, 0.04]} s={[0.116, 0.025, 0.276]} />
          <B g={CYL} c={PANTS} p={[0.1 * sx, 0.5, 0]} s={[0.078, 0.8, 0.078]} />
          <B g={CYL} c="#1f222a" p={[0.1 * sx, 0.12, 0]} s={[0.07, 0.05, 0.07]} />
        </group>
      ))}
      <B g={CYL} c={PANTS} p={[0, 0.88, 0]} s={[0.19, 0.14, 0.15]} />

      {/* hoodie */}
      <mesh geometry={TORSO} material={m(HOODIE)} position={[0, 1.19, 0]} scale={[0.215, 0.6, 0.165]} />
      <B g={CYL} c={HOODIE_DARK} p={[0, 0.92, 0]} s={[0.222, 0.06, 0.172]} />
      <B c={HOODIE} p={[0, 1.47, 0]} s={[0.25, 0.09, 0.165]} />
      <B g={BOX} c="#1e1b21" p={[0, 1.06, 0.17]} s={[0.22, 0.13, 0.012]} />
      <mesh position={[0, 1.29, 0.168]} material={hoodieLogo()}>
        <planeGeometry args={[0.27, 0.0675]} />
      </mesh>
      {[-1, 1].map((sx) => (
        <group key={sx}>
          <B g={CYL} c={PINK} p={[0.045 * sx, 1.38, 0.168]} s={[0.006, 0.14, 0.006]} />
          <B c={PINK} p={[0.045 * sx, 1.305, 0.168]} s={[0.011, 0.014, 0.011]} />
        </group>
      ))}
      {/* hood resting behind the neck */}
      <B c={HOODIE} p={[0, 1.54, -0.1]} s={[0.15, 0.1, 0.09]} />
      <B g={CYL} c={HOODIE} p={[0, 1.515, 0]} s={[0.115, 0.06, 0.105]} />
      <B g={CYL} c={SKIN} p={[0, 1.56, 0]} s={[0.048, 0.08, 0.048]} />

      {/* Labubu keychain clipped to his right belt loop */}
      <group ref={charm} position={[-0.17, 0.9, 0.11]}>
        <B g={TORUS} c="#c9ccd2" o={{ metalness: 0.9, roughness: 0.25 }} r={[0, Math.PI / 2, 0]} s={[0.016, 0.016, 0.016]} />
        <B g={CYL} c="#c9ccd2" o={{ metalness: 0.9, roughness: 0.25 }} p={[0, -0.04, 0]} s={[0.003, 0.06, 0.003]} />
        <Labubu height={0.14} fur="#5a3d2e" expression="mischief" position={[0, -0.215, 0.01]} />
      </group>

      {/* arms: left hangs, right holds the chainsaw */}
      <group ref={otherArm} position={[0.25, 1.45, 0]} rotation={[0.05, 0, 0.12]}>
        {arm}
      </group>
      <group ref={sawArm} position={[-0.25, 1.45, 0]} rotation={[-2.6, 0, -0.12]}>
        {arm}
        <Chainsaw />
      </group>

      <group ref={head} position={[0, 1.56, 0]}>
        <Head mouth={mouth} />
      </group>
    </group>
  )
}
