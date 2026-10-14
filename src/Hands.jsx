import { useEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { chat, useChat } from './chat.js'
import { RIVALS } from './Rivals.jsx'
import { MELEE } from './weapons.js'

// First-person hands, parented to the camera so they move with your view. Drawn on top of everything
// (no depth test) so they never poke through walls. They hold your melee weapon in the right
// hand and business cards in the left, and animate swings and throws; a flashlight rides along too.

// a faint self-glow (spill from the flashlight) keeps your hands readable in the dark
const onTop = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, depthTest: false, depthWrite: false, emissive: color, emissiveIntensity: 0.22, ...o })
const M = {
  sleeve: onTop('#1f2a44'),
  cuff: onTop('#151c30'),
  skin: onTop('#c99a72', { roughness: 0.6 }),
  paper: onTop('#e9e4d6', { roughness: 0.9 }),
  ink: onTop('#3b3b3b'),
  leather: onTop('#5a3420', { roughness: 0.5 }),
  brass: onTop('#c9a44a', { metalness: 0.8, roughness: 0.3 }),
  card: onTop('#f7f5ef', { roughness: 0.4 }),
  steel: onTop('#b9bec6', { metalness: 0.85, roughness: 0.3 }),
  red: onTop('#b3262e'),
  blaster: onTop('#00356b', { metalness: 0.5, roughness: 0.35 }),
  blasterGlow: onTop('#7fb2ff', { emissive: '#4a90ff', emissiveIntensity: 4 }),
}
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14)
const BOX = new THREE.BoxGeometry(1, 1, 1)
const SPH = new THREE.SphereGeometry(1, 16, 12)
const TOR = new THREE.TorusGeometry(1, 0.25, 8, 16, Math.PI)

// a part along the arm (arms point down -z, the camera's forward)
const P = ({ g = BOX, m, p, s, r = [0, 0, 0] }) => <mesh geometry={g} material={m} position={p} scale={s} rotation={r} renderOrder={999} />

function Arm({ children }) {
  return (
    <>
      <P g={CYL} m={M.sleeve} p={[0, 0, -0.22]} r={[Math.PI / 2, 0, 0]} s={[0.055, 0.44, 0.055]} />
      <P g={CYL} m={M.cuff} p={[0, 0, -0.44]} r={[Math.PI / 2, 0, 0]} s={[0.05, 0.04, 0.05]} />
      <P g={SPH} m={M.skin} p={[0, -0.005, -0.5]} s={[0.045, 0.035, 0.06]} />
      {/* thumb */}
      <P g={SPH} m={M.skin} p={[-0.035, 0.012, -0.485]} s={[0.016, 0.014, 0.03]} r={[0, 0.5, 0]} />
      {children}
    </>
  )
}

const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 - (1 - k) ** 3)

export default function Hands() {
  const { camera, scene } = useThree()
  const right = useRef()
  const left = useRef()
  const light = useRef()
  const cup = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])
  const last = useRef(new THREE.Vector3())
  const bob = useRef(0)
  const melee = useChat((s) => s.melee) || 'wsj'
  const inv = useChat((s) => s.inv)
  const ranged = useChat((s) => s.ranged)

  // children of the camera only render if the camera is part of the scene
  useEffect(() => {
    scene.add(camera)
    return () => scene.remove(camera)
  }, [scene, camera])
  useEffect(() => {
    if (light.current) light.current.target = target
  }, [target])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const now = performance.now()
    // bob with walking speed
    const speed = camera.position.distanceTo(last.current) / Math.max(dt, 1e-3)
    last.current.copy(camera.position)
    bob.current += dt * Math.min(speed, 10) * 1.6
    const walk = Math.min(1, speed / 5)
    const by = Math.sin(bob.current * 2) * 0.012 * walk + Math.sin(t * 1.6) * 0.003
    const bx = Math.cos(bob.current) * 0.01 * walk

    // right arm: melee swing / pet reach
    const R = right.current
    R.position.set(0.3 + bx, -0.36 + by, -0.12)
    R.rotation.set(0.12, -0.12, 0)
    const act = RIVALS.act
    if (act?.kind === 'melee') {
      const dur = MELEE[RIVALS.melee].cooldown * 900
      const k = (now - act.at) / dur
      if (k < 1) {
        const wind = ease(Math.min(1, k * 3)) // quick raise
        const swing = ease(Math.max(0, (k - 0.25) / 0.75)) // then swipe down-left
        R.rotation.x = 0.12 + wind * 0.7 - swing * 1.3
        R.rotation.y = -0.12 - wind * 0.4 + swing * 1.1
        R.position.x -= swing * 0.12
      }
    }

    // left arm: card flick, overhand throws
    const L = left.current
    L.position.set(-0.3 - bx, -0.38 + by, -0.12)
    L.rotation.set(0.12, 0.12, 0)
    // a sip of coffee: bring the cup up to your mouth and back
    const sipping = act?.kind === 'drink' && now - act.at < 900
    if (sipping) {
      const s = Math.sin(((now - act.at) / 900) * Math.PI)
      L.rotation.x = 0.12 + s * 1.0
      L.rotation.y = 0.12 - s * 0.5
      L.position.x += s * 0.12
      L.position.y += s * 0.14
    }
    cup.current.visible = sipping
    if (act && (act.kind === 'card' || act.kind === 'thermos' || act.kind === 'takeover' || act.kind === 'crash')) {
      const k = (now - act.at) / (act.kind === 'card' ? 260 : 520)
      if (k < 1) {
        const s = Math.sin(k * Math.PI)
        if (act.kind === 'card') {
          L.rotation.y = 0.12 + 0.6 * (1 - k) - s * 0.9 // flick across
        } else {
          L.rotation.x = 0.12 + s * 1.1 - k * 0.4 // overhand lob
          L.position.y += s * 0.08
        }
      }
    }

    // flashlight: a slight sway, and it sputters when you're badly hurt
    if (light.current) {
      const hp = chat.get().hp ?? 100
      const sputter = hp < 30 && Math.random() < 0.06 ? 0.15 : 1
      light.current.intensity = 10 * sputter
      target.position.set(Math.sin(t * 0.7) * 0.08, -0.15 + by * 2, -6)
    }
  })

  // the left hand shows whatever long-range item is picked on the weapon wheel
  const card = ranged === 'cards' && inv?.cards > 0
  const thermos = ranged === 'thermos' && inv?.thermos > 0
  const blaster = ranged === 'blaster' && inv?.blaster != null
  return createPortal(
    <group>
      <group ref={right}>
        <Arm>
          {melee === 'wsj' && (
            // a rolled-up Wall Street Journal, held like a baton
            <group position={[0, 0.02, -0.52]} rotation={[-0.9, 0, 0]}>
              <P g={CYL} m={M.paper} p={[0, 0.17, 0]} s={[0.032, 0.36, 0.032]} />
              <P g={CYL} m={M.ink} p={[0, 0.2, 0]} s={[0.0325, 0.05, 0.0325]} />
              <P g={CYL} m={M.ink} p={[0, 0.08, 0]} s={[0.0325, 0.02, 0.0325]} />
            </group>
          )}
          {melee === 'gavel' && (
            // the Golden Gavel
            <group position={[0, 0.02, -0.52]} rotation={[-0.9, 0, 0]}>
              <P g={CYL} m={M.brass} p={[0, 0.12, 0]} s={[0.018, 0.3, 0.018]} />
              <P g={CYL} m={M.brass} p={[0, 0.3, 0]} r={[0, 0, Math.PI / 2]} s={[0.05, 0.2, 0.05]} />
            </group>
          )}
          {melee === 'briefcase' && (
            // leather briefcase by the handle
            <group position={[-0.04, -0.06, -0.56]} rotation={[0.15, 0.35, 0.1]}>
              <P m={M.leather} s={[0.3, 0.22, 0.08]} />
              <P g={TOR} m={M.leather} p={[0, 0.13, 0]} s={[0.05, 0.04, 0.05]} />
              <P m={M.brass} p={[-0.08, 0.07, 0.042]} s={[0.03, 0.02, 0.01]} />
              <P m={M.brass} p={[0.08, 0.07, 0.042]} s={[0.03, 0.02, 0.01]} />
            </group>
          )}
        </Arm>
      </group>
      <group ref={left}>
        <Arm>
          {card && (
            // a fan of embossed business cards
            <group position={[0.01, 0.025, -0.53]} rotation={[-0.4, 0, 0.3]}>
              {[-0.2, 0, 0.2].map((a, i) => (
                <P key={i} m={M.card} p={[i * 0.006, 0, 0]} r={[0, 0, a]} s={[0.09, 0.055, 0.003]} />
              ))}
            </group>
          )}
          {/* a paper coffee cup, only while you're taking a sip */}
          <group ref={cup} position={[0.0, 0.07, -0.52]} visible={false}>
            <P g={CYL} m={M.card} s={[0.042, 0.11, 0.042]} />
            <P g={CYL} m={M.red} p={[0, 0.06, 0]} s={[0.045, 0.015, 0.045]} />
          </group>
          {blaster && (
            // the Bulldog Blaster: a chunky Yale-blue ray gun with a glowing tip
            <group position={[0.0, 0.05, -0.55]} rotation={[0.05, 0, 0.1]}>
              <P m={M.blaster} s={[0.07, 0.08, 0.2]} />
              <P g={CYL} m={M.steel} p={[0, 0.01, -0.14]} r={[Math.PI / 2, 0, 0]} s={[0.022, 0.12, 0.022]} />
              <P g={CYL} m={M.blasterGlow} p={[0, 0.01, -0.21]} r={[Math.PI / 2, 0, 0]} s={[0.028, 0.02, 0.028]} />
              <P m={M.blaster} p={[0, -0.07, 0.05]} r={[0.3, 0, 0]} s={[0.05, 0.1, 0.05]} />
            </group>
          )}
          {thermos && (
            // a steel coffee thermos with a red cap
            <group position={[0.0, 0.06, -0.53]} rotation={[-0.2, 0, 0.15]}>
              <P g={CYL} m={M.steel} s={[0.04, 0.2, 0.04]} />
              <P g={CYL} m={M.red} p={[0, 0.115, 0]} s={[0.042, 0.04, 0.042]} />
            </group>
          )}
        </Arm>
      </group>
      {/* the flashlight: just ahead of the hands, so it lights the hall but not your own fists */}
      <spotLight ref={light} position={[0.12, -0.08, -0.62]} angle={0.45} penumbra={0.65} distance={30} decay={1.5} color="#e8f0ff" intensity={10} />
      <primitive object={target} />
    </group>,
    camera,
  )
}
