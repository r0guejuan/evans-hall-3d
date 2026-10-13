import { useMemo } from 'react'
import * as THREE from 'three'
import Zaman from './Zaman.jsx'
import Schott from './Schott.jsx'
import { DRUMS, LECTERNS } from './layout.js'

// The two professors you can talk to, each at the front of their classroom with a brass name plaque.
// The course database puts MGT 409 (Zaman) in Evans 2200; Schott's EMBA stats course has no room in the
// database, so he's next door in 2210.
const FACULTY = [
  { room: '2200', Avatar: Zaman, name: 'Zaman' },
  { room: '2210', Avatar: Schott, name: 'Schott' },
]

function plaqueTex(name) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#c9a44a'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#2a1d0c'
  g.fillRect(8, 8, 496, 112)
  g.fillStyle = '#f3dfa8'
  g.font = 'bold 44px Georgia, serif'
  g.textAlign = 'center'
  g.fillText(`Prof. ${name}`, 256, 80)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function Faculty() {
  const items = useMemo(
    () =>
      FACULTY.map(({ room, Avatar, name }) => {
        const i = DRUMS.findIndex((d) => d.id === room)
        const { fc, back, t, half, rot } = DRUMS[i].front
        const lec = LECTERNS[i]
        return {
          Avatar,
          pos: [fc[0] + back[0] * 1.15 - t[0] * half * 0.3, 0, fc[1] + back[1] * 1.15 - t[1] * half * 0.3],
          rot,
          plaque: { p: [lec.x + back[0] * 0.26, 0.85, lec.z + back[1] * 0.26], mat: new THREE.MeshBasicMaterial({ map: plaqueTex(name) }) },
        }
      }),
    [],
  )
  return items.map(({ Avatar, pos, rot, plaque }, k) => (
    <group key={k}>
      <Avatar position={pos} rotation={rot} />
      <mesh position={plaque.p} rotation={[0, rot, 0]} material={plaque.mat}>
        <planeGeometry args={[0.6, 0.15]} />
      </mesh>
    </group>
  ))
}
