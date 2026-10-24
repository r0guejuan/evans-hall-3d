import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FALL } from './theme.js'
import { rng } from './textures.js'

// Greenery: procedural trees (tapered trunk, branches, clumps of leaf cards) and the
// Poly Haven potted plant. Leaf cards are flat quads with a cut-out texture of many small leaves, the
// usual game-engine trick for foliage; from a few meters away they read as a real canopy.

function leafTex() {
  const S = 512
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  const r = rng(31)
  // New England in late November: reds, oranges, golds, a few hold-out greens
  const greens = FALL
    ? ['#b8321f', '#d4561c', '#e07b1a', '#e8a21e', '#c9881a', '#a8291c', '#f0b83a', '#7d8a2e']
    : ['#2f5a26', '#3d6b2f', '#4f7d38', '#5f8d40', '#3a6330', '#6a9a45']
  for (let i = 0; i < 420; i++) {
    // denser toward the middle so each card reads as a rounded clump, not a square
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * S * 0.46
    const x = S / 2 + Math.cos(a) * d
    const y = S / 2 + Math.sin(a) * d
    const len = 14 + r() * 16
    g.save()
    g.translate(x, y)
    g.rotate(r() * Math.PI * 2)
    g.fillStyle = greens[Math.floor(r() * greens.length)]
    g.beginPath()
    g.ellipse(0, 0, len, len * 0.42, 0, 0, Math.PI * 2)
    g.fill()
    g.strokeStyle = 'rgba(20,35,15,0.35)' // midrib
    g.lineWidth = 1.2
    g.beginPath()
    g.moveTo(-len, 0)
    g.lineTo(len, 0)
    g.stroke()
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function barkTex() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')
  g.fillStyle = '#5a4634'
  g.fillRect(0, 0, 128, 256)
  const r = rng(37)
  for (let i = 0; i < 220; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(30,22,15,0.45)' : 'rgba(140,120,95,0.25)'
    g.fillRect(r() * 128, r() * 256, 1 + r() * 2, 8 + r() * 30) // vertical furrows
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

// one tree, 1 unit tall, as two merged geometries: wood and leaves
function treeGeometries(seed) {
  const r = rng(seed)
  const wood = []
  const leaves = []
  const up = new THREE.Vector3(0, 1, 0)
  const limb = (from, dir, len, r0, r1) => {
    const geo = new THREE.CylinderGeometry(r1, r0, len, 7, 1)
    geo.translate(0, len / 2, 0)
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize()))
    geo.translate(from.x, from.y, from.z)
    wood.push(geo)
    return from.clone().add(dir.clone().normalize().multiplyScalar(len))
  }
  const clump = (center, radius, n) => {
    for (let i = 0; i < n; i++) {
      const q = new THREE.PlaneGeometry(radius * 1.5, radius * 1.5)
      q.rotateX(r() * Math.PI)
      q.rotateY(r() * Math.PI)
      q.rotateZ(r() * Math.PI)
      const off = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).multiplyScalar(radius * 1.2)
      q.translate(center.x + off.x, center.y + off.y, center.z + off.z)
      leaves.push(q)
    }
  }
  const lean = new THREE.Vector3((r() - 0.5) * 0.12, 1, (r() - 0.5) * 0.12)
  const top = limb(new THREE.Vector3(0, 0, 0), lean, 0.55, 0.045, 0.03)
  clump(new THREE.Vector3(top.x, 0.78, top.z), 0.17, 18)
  const branches = 5 + Math.floor(r() * 3)
  for (let b = 0; b < branches; b++) {
    const a = (b / branches) * Math.PI * 2 + r() * 0.6
    const y = 0.32 + r() * 0.2
    const dir = new THREE.Vector3(Math.cos(a), 0.7 + r() * 0.5, Math.sin(a))
    const tip = limb(new THREE.Vector3(lean.x * y, y, lean.z * y), dir, 0.2 + r() * 0.14, 0.018, 0.008)
    clump(tip.add(new THREE.Vector3(0, 0.06, 0)), 0.13 + r() * 0.05, 12)
  }
  return { wood: mergeGeometries(wood), leaves: mergeGeometries(leaves) }
}

const VARIANTS = [11, 23, 47].map(treeGeometries) // three shapes so the forest isn't copy-paste
let mats
const treeMats = () =>
  (mats ??= {
    wood: new THREE.MeshStandardMaterial({ map: barkTex(), roughness: 0.95 }),
    leaves: new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 }),
  })

// spots: [{ x, y, z, h }] (y = ground height, h = tree height in meters)
export function Trees({ spots }) {
  const groups = useMemo(() => VARIANTS.map((_, v) => spots.filter((_, i) => i % VARIANTS.length === v)), [spots])
  return groups.map((items, v) => <TreeBatch key={v} variant={VARIANTS[v]} items={items} seed={v} />)
}

function TreeBatch({ variant, items, seed }) {
  const wood = useRef()
  const leaves = useRef()
  const M = treeMats()
  useLayoutEffect(() => {
    if (!items.length) return
    const r = rng(100 + seed)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const tint = new THREE.Color()
    items.forEach((it, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2)
      const w = it.h * (0.85 + r() * 0.3) // a little wider or narrower than tall
      m.compose(new THREE.Vector3(it.x, it.y, it.z), q, new THREE.Vector3(w, it.h, w))
      wood.current.setMatrixAt(i, m)
      leaves.current.setMatrixAt(i, m)
      // each canopy a slightly different green (or, in the fall, its own warm shade, some redder, some golder)
      if (FALL) tint.setHSL(0.03 + r() * 0.09, 0.35 + r() * 0.3, 0.72 + r() * 0.12)
      else tint.setHSL(0.27 + (r() - 0.5) * 0.05, 0.25 + r() * 0.2, 0.5 + r() * 0.15)
      leaves.current.setColorAt(i, tint)
    })
    for (const mesh of [wood.current, leaves.current]) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    leaves.current.instanceColor.needsUpdate = true
  }, [items, seed])
  if (!items.length) return null
  return (
    <>
      <instancedMesh ref={wood} args={[variant.wood, M.wood, items.length]} frustumCulled={false} />
      <instancedMesh ref={leaves} args={[variant.leaves, M.leaves, items.length]} frustumCulled={false} />
    </>
  )
}

// ---------- the Poly Haven potted plant (public/models/potted_plant_02, CC0)
function PlantModels({ spots, scale }) {
  const gltf = useLoader(GLTFLoader, `${import.meta.env.BASE_URL}models/potted_plant_02/potted_plant_02.gltf`)
  const copies = useMemo(
    () =>
      spots.map(([x, z], i) => {
        const o = gltf.scene.clone(true)
        o.position.set(x, 0, z)
        o.rotation.y = i * 1.7
        o.scale.setScalar(scale)
        o.traverse((c) => {
          if (c.isMesh) c.castShadow = c.receiveShadow = true
        })
        return o
      }),
    [gltf, spots, scale],
  )
  return copies.map((o, i) => <primitive key={i} object={o} />)
}

export function PottedPlants({ spots, scale = 1.4 }) {
  // its own Suspense, so the rest of the building doesn't wait on the model
  return (
    <Suspense fallback={null}>
      <PlantModels spots={spots} scale={scale} />
    </Suspense>
  )
}
