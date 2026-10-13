import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { chat } from './chat.js'
import { COLLIDERS, DRUMS, collide, floorAt } from './layout.js'
import { RING, ROOMS, nearestRing, ringPath } from './nav.js'
import { DAN } from './HandsomeDan.jsx'
import { ZAMAN } from './Zaman.jsx'
import Labubu from './Labubu.jsx'
import { NOTES } from './notes.js'
import { CRASH, ITEMS, MELEE, SHURIKEN, TAKEOVER, THERMOS, bounty } from './weapons.js'
import * as sfx from './sfx.js'

// Rivals: the game. It's night in Evans Hall and Harvard zombies (crimson sweaters, white H) shamble through
// the cloister in waves that grow bigger and tougher. Yale students in Halloween costumes roam the halls
// hunting them, and Handsome Dan fights at your side, unlocking abilities as the kill count grows. You
// fight with business school gear bought with Endowment, power-ups earned by answering the professors'
// questions (answers hidden on study notes around the building), and coffee from the snack table when
// you're hurt. From wave 2 a thief zombie goes for the Labubu on Prof. Zaman's pants: once it grabs it,
// you have 90 seconds to take it back, or Harvard wins.
// Zombies and students are instanced rigs (one InstancedMesh per body part), posed by hand each frame.

const MAX_ZOMBIES = 40
const STUDENTS = 25 // the starting squad: they help, but the fight is yours
const MAX_STUDENTS = 33 // room for reinforcements (Agent Army)
const Z_SPEED = 1.1 // m/s, plus a little per wave
const S_SPEED = 2.6
const DAN_SPEED = 4.8
const REACH = 0.85 // melee range
const PLAYER_DPS = 14 // health per second while a zombie is on you
const CLAW_DPS = 1 // zombie damage to a student per second
const PUNCH = 0.8 // student punch damage, once a second
const SIGHT_S = 15 // how far a Yale student spots a zombie
const PER_ZOMBIE = 3 // at most this many students gang up on one zombie (the rest find another, or patrol)
const PER_THIEF = 6 // ...but a Labubu thief gets mobbed
const SPACE_S = 1.0 // students keep this far apart (m)
const SIGHT_Z = 11 // how far a zombie notices a student (or you)
const STALKER_SHARE = 0.35 // this share of each wave comes straight for you
const STALK_AFTER = 40 // seconds: after this, every zombie smells you
const DAN_LEASH = 6 // Dan never strays farther than this from you
const BITE_DPS = 2 // Dan's bite at level 1
export const BONK = 1.5 // your bonk
const BONK_RANGE = 3.2
const SPELL_RADIUS = 9
const SPELL_DAMAGE = 6
const DOWN_TIME = 3 // seconds a dead zombie lies there before it sinks away
const KO_TIME = 6 // seconds a knocked-out student stays down
const NOTE_RANGE = 3.5
const INTERMISSION = 25 // seconds between waves to visit the Endowment Office
const START_ENDOWMENT = 300
const LABUBU_TIME = 90 // seconds to get the Labubu back before Harvard wins
export const VENDING = { x: -30.5, z: 12.45, rot: 0 } // against Ross Library's south wall, facing the cloister (+x east, -z north)
// the coffee & snack table: south cloister (z > 0 is south), against the courtyard glass, facing the corridor
export const COFFEE = { x: -4, z: 18.75, heal: 35, refill: 25 }
const ZAMAN_ROOM = ROOMS[DRUMS.findIndex((d) => d.id === '2200')]

// Handsome Dan levels up with the team's kills
export const DAN_LEVELS = [
  { kills: 0, name: 'Bite', icon: '🦷' },
  { kills: 20, name: 'Bark Stun', icon: '📢' },
  { kills: 50, name: 'Bulldog Charge', icon: '💨' },
  { kills: 90, name: 'Boola Boola Howl', icon: '🎶' },
  { kills: 150, name: 'Golden Dan', icon: '🌟' },
]
const danLevel = (kills) => DAN_LEVELS.filter((l) => kills >= l.kills).length // 1..5

// ---------- rig parts (figure ~1.75 m, faces +z). groups: body, head, armL, armR, legL, legR
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10)
const SPH = new THREE.SphereGeometry(1, 12, 8)
const BOXG = new THREE.BoxGeometry(1, 1, 1)
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })

function rigParts(look) {
  const L = {
    skin: std(look.skin),
    shirt: std(look.shirt),
    pants: std(look.pants),
    hair: std(look.hair),
    // glowing eyes: bright enough to bloom in the dark
    eye: std(look.eye, look.eyeGlow ? { emissive: look.eye, emissiveIntensity: 6 } : { roughness: 0.2 }),
    white: std('#f4f2ee'),
    shoe: std(look.shoe),
    dark: std('#2a1612'),
  }
  const parts = [
    // shirt / pants: tinted per student by costume (instance color); hideFor / only: costume visibility
    { grp: 'body', g: CYL, m: L.shirt, p: [0, 1.17, 0], s: [0.2, 0.55, 0.13], hit: true, shirt: true },
    { grp: 'body', g: CYL, m: L.pants, p: [0, 0.9, 0], s: [0.18, 0.14, 0.12], pants: true },
    { grp: 'body', g: CYL, m: L.skin, p: [0, 1.5, 0], s: [0.05, 0.08, 0.05], skin: true, hideFor: ['ghost', 'whiffenpoof'] },
    { grp: 'head', g: SPH, m: L.skin, p: [0, 0.13, 0], s: [0.105, 0.125, 0.11], skin: true, hit: true, hideFor: ['ghost', 'pumpkin', 'whiffenpoof'] },
    { grp: 'head', g: SPH, m: L.hair, p: [0, 0.19, -0.012], s: [0.11, 0.075, 0.115], hair: true, hideFor: ['ghost', 'pumpkin', 'bulldog', 'whiffenpoof', 'mummy', 'quarterback', 'reaper'] },
    ...[-1, 1].map((sx) => ({ grp: 'head', g: SPH, m: L.eye, p: [0.04 * sx, 0.145, 0.1], s: [0.017, 0.017, 0.01], hideFor: ['ghost', 'pumpkin', 'whiffenpoof', 'mummy', 'reaper'] })),
    ...['armL', 'armR'].flatMap((grp) => [
      { grp, g: CYL, m: L.shirt, p: [0, -0.24, 0], s: [0.055, 0.48, 0.055], shirt: true },
      { grp, g: SPH, m: L.skin, p: [0, -0.5, 0], s: [0.045, 0.05, 0.045], skin: true },
    ]),
    ...['legL', 'legR'].flatMap((grp) => [
      { grp, g: CYL, m: L.pants, p: [0, -0.42, 0], s: [0.07, 0.84, 0.07], pants: true },
      { grp, g: BOXG, m: L.shoe, p: [0, -0.86, 0.04], s: [0.1, 0.07, 0.22] },
    ]),
  ]
  if (look.letter === 'H') {
    // Harvard: white H on a crimson sweater, plus a grim little mouth
    parts.push(
      { grp: 'body', g: BOXG, m: L.white, p: [-0.045, 1.26, 0.133], s: [0.022, 0.15, 0.01] },
      { grp: 'body', g: BOXG, m: L.white, p: [0.045, 1.26, 0.133], s: [0.022, 0.15, 0.01] },
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.26, 0.133], s: [0.09, 0.022, 0.01] },
      { grp: 'head', g: BOXG, m: L.dark, p: [0, 0.07, 0.105], s: [0.05, 0.014, 0.01] },
    )
  } else {
    parts.push(...costumeParts(L))
  }
  return parts.map((pt) => ({
    ...pt,
    local: new THREE.Matrix4().compose(
      new THREE.Vector3(...pt.p),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(pt.r || [0, 0, 0]))),
      new THREE.Vector3(...pt.s),
    ),
  }))
}

// ---------- Yale students' Halloween costumes (all Yale-themed)
export const COSTUMES = {
  skeleton: { name: 'Skull & Bones', shirt: '#141416', pants: '#141416' },
  bulldog: { name: 'Handsome Dan onesie', shirt: '#e8e0d0', pants: '#e8e0d0' },
  hale: { name: 'Nathan Hale', shirt: '#1b2f5c', pants: '#d8cfb8' },
  ghost: { name: 'Ghost of Elihu Yale', shirt: '#f2f2ee', pants: '#f2f2ee' },
  pumpkin: { name: 'Boola-Boola Pumpkin', shirt: '#00356b', pants: '#2b3a55' },
  mummy: { name: 'Peabody Museum Mummy', shirt: '#d9cfb4', pants: '#d9cfb4' },
  vampire: { name: 'Vampire of Sterling Library', shirt: '#121216', pants: '#121216' },
  witch: { name: 'Witch of Harkness Tower', shirt: '#00356b', pants: '#00356b' },
  quarterback: { name: 'Yale Bowl Zombie Slayer', shirt: '#00356b', pants: '#efece4' },
  whiffenpoof: { name: 'Headless Whiffenpoof', shirt: '#101014', pants: '#101014' },
  reaper: { name: 'Grim Reaper of Finals Week', shirt: '#0b0b0e', pants: '#0b0b0e' },
}
const COSTUME_IDS = Object.keys(COSTUMES)
const SHEET = new THREE.CylinderGeometry(0.75, 1, 1, 18)
const CONE = new THREE.ConeGeometry(1, 1, 14)
function costumeParts(L) {
  const bone = std('#efeee6')
  const black = std('#0c0c0e')
  const cream = std('#e8e0d0')
  const fawn = std('#9b6a42')
  const blue = std('#00356b')
  const brass = std('#c9a44a', { metalness: 0.7, roughness: 0.35 })
  const sheet = std('#f2f2ee', { roughness: 0.95 })
  const orange = std('#e07a1f', { roughness: 0.7 })
  const glow = std('#ffb340', { emissive: '#ffb340', emissiveIntensity: 5 }) // candle inside the pumpkin
  const green = std('#3f6b2a')
  const gauze = std('#c9bd9c', { roughness: 1 })
  const ghoul = std('#7dff9a', { emissive: '#7dff9a', emissiveIntensity: 6 }) // the mummy's eyes
  const ice = std('#8fd3ff', { emissive: '#8fd3ff', emissiveIntensity: 6 }) // the reaper's eyes
  const red = std('#9e0f1c', { roughness: 0.5 })
  const steel = std('#b9bec6', { metalness: 0.85, roughness: 0.25 })
  const wood = std('#4a3020')
  const grey = std('#8a8f96', { metalness: 0.4, roughness: 0.5 })
  const only = (c, list) => list.map((pt) => ({ ...pt, only: [c] }))
  return [
    // Skull & Bones: ribs, spine, leg bones, and a skull mask
    ...only('skeleton', [
      ...[0, 1, 2, 3].map((k) => ({ grp: 'body', g: BOXG, m: bone, p: [0, 1.38 - k * 0.065, 0.133], s: [0.15 - k * 0.012, 0.015, 0.01] })),
      { grp: 'body', g: BOXG, m: bone, p: [0, 1.2, 0.134], s: [0.018, 0.32, 0.01] },
      ...['legL', 'legR'].map((grp) => ({ grp, g: BOXG, m: bone, p: [0, -0.42, 0.072], s: [0.022, 0.7, 0.01] })),
      ...['armL', 'armR'].map((grp) => ({ grp, g: BOXG, m: bone, p: [0, -0.24, 0.057], s: [0.016, 0.4, 0.01] })),
      { grp: 'head', g: SPH, m: bone, p: [0, 0.13, 0.03], s: [0.108, 0.128, 0.1] },
      ...[-1, 1].map((sx) => ({ grp: 'head', g: SPH, m: black, p: [0.04 * sx, 0.15, 0.115], s: [0.026, 0.03, 0.012] })),
      { grp: 'head', g: SPH, m: black, p: [0, 0.105, 0.125], s: [0.012, 0.016, 0.006] },
      { grp: 'head', g: BOXG, m: black, p: [0, 0.07, 0.12], s: [0.05, 0.006, 0.006] },
    ]),
    // Handsome Dan onesie: bulldog hood with floppy ears, fawn patches, a Yale-blue collar, a little tail
    ...only('bulldog', [
      { grp: 'head', g: SPH, m: cream, p: [0, 0.16, -0.035], s: [0.128, 0.14, 0.125] },
      ...[-1, 1].map((sx) => ({ grp: 'head', g: SPH, m: fawn, p: [0.115 * sx, 0.23, -0.02], r: [0, 0, 0.6 * sx], s: [0.055, 0.03, 0.045] })),
      { grp: 'head', g: SPH, m: fawn, p: [0.05, 0.25, 0.04], s: [0.05, 0.035, 0.04] },
      { grp: 'body', g: SPH, m: fawn, p: [0.08, 1.28, 0.115], s: [0.06, 0.07, 0.025] },
      { grp: 'body', g: SPH, m: fawn, p: [-0.09, 1.05, 0.1], s: [0.05, 0.05, 0.03] },
      { grp: 'body', g: CYL, m: blue, p: [0, 1.46, 0], s: [0.115, 0.03, 0.105] },
      { grp: 'body', g: SPH, m: cream, p: [0, 0.95, -0.14], s: [0.035, 0.05, 0.035] },
    ]),
    // Nathan Hale (his statue stands on Old Campus): tricorn hat, cravat, brass buttons, coat tails
    ...only('hale', [
      { grp: 'head', g: CYL, m: black, p: [0, 0.255, 0], s: [0.155, 0.025, 0.155] },
      { grp: 'head', g: SPH, m: black, p: [0, 0.27, 0], s: [0.095, 0.06, 0.095] },
      ...[0, 2.1, 4.2].map((a) => ({ grp: 'head', g: BOXG, m: black, p: [Math.sin(a) * 0.12, 0.28, Math.cos(a) * 0.12], r: [0, a, 0.5], s: [0.1, 0.05, 0.02] })),
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.43, 0.125], s: [0.06, 0.07, 0.02] },
      ...[1.36, 1.26, 1.16, 1.06].flatMap((y) => [-1, 1].map((sx) => ({ grp: 'body', g: SPH, m: brass, p: [0.05 * sx, y, 0.133], s: [0.01, 0.01, 0.006] }))),
      { grp: 'body', g: BOXG, m: L.shirt, p: [0, 0.92, -0.12], s: [0.3, 0.36, 0.03], shirt: true },
      { grp: 'head', g: SPH, m: L.white, p: [0, 0.15, -0.115], s: [0.03, 0.05, 0.03] },
    ]),
    // Ghost of Elihu Yale: a bedsheet with eye holes and a big Yale-blue Y
    ...only('ghost', [
      { grp: 'body', g: SHEET, m: sheet, p: [0, 1.0, 0], s: [0.27, 1.25, 0.25] },
      { grp: 'body', g: SPH, m: sheet, p: [0, 1.62, 0], s: [0.21, 0.23, 0.2] },
      ...[-1, 1].map((sx) => ({ grp: 'body', g: SPH, m: black, p: [0.065 * sx, 1.68, 0.175], s: [0.03, 0.042, 0.01] })),
      { grp: 'body', g: BOXG, m: blue, p: [0, 1.12, 0.25], s: [0.035, 0.14, 0.01] },
      { grp: 'body', g: BOXG, m: blue, p: [-0.045, 1.24, 0.245], r: [0, 0, 0.55], s: [0.035, 0.15, 0.01] },
      { grp: 'body', g: BOXG, m: blue, p: [0.045, 1.24, 0.245], r: [0, 0, -0.55], s: [0.035, 0.15, 0.01] },
    ]),
    // Boola-Boola Pumpkin: a glowing jack-o'-lantern head on a Yale hoodie (white Y, hood at the back)
    ...only('pumpkin', [
      { grp: 'head', g: SPH, m: orange, p: [0, 0.14, 0], s: [0.165, 0.145, 0.165] },
      { grp: 'head', g: CYL, m: green, p: [0, 0.3, 0], s: [0.016, 0.05, 0.016] },
      ...[-1, 1].map((sx) => ({ grp: 'head', g: BOXG, m: glow, p: [0.06 * sx, 0.17, 0.152], r: [0, 0, Math.PI / 4], s: [0.035, 0.035, 0.012] })),
      { grp: 'head', g: BOXG, m: glow, p: [0, 0.085, 0.155], s: [0.1, 0.022, 0.012] },
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.2, 0.133], s: [0.022, 0.09, 0.01] },
      { grp: 'body', g: BOXG, m: L.white, p: [-0.028, 1.285, 0.133], r: [0, 0, 0.55], s: [0.022, 0.1, 0.01] },
      { grp: 'body', g: BOXG, m: L.white, p: [0.028, 1.285, 0.133], r: [0, 0, -0.55], s: [0.022, 0.1, 0.01] },
      { grp: 'body', g: SPH, m: L.shirt, p: [0, 1.47, -0.1], s: [0.13, 0.08, 0.08], shirt: true },
    ]),
    // Peabody Museum Mummy: bandage wraps everywhere, a wrapped head, glowing green eyes
    ...only('mummy', [
      { grp: 'head', g: SPH, m: gauze, p: [0, 0.13, 0], s: [0.113, 0.132, 0.117] },
      ...[0.06, 0.12, 0.2].map((y, k) => ({ grp: 'head', g: BOXG, m: L.shirt, p: [0, y, 0.105], r: [0, 0, (k - 1) * 0.25], s: [0.2, 0.018, 0.02], shirt: true })),
      { grp: 'head', g: BOXG, m: black, p: [0, 0.148, 0.113], s: [0.12, 0.03, 0.006] },
      ...[-1, 1].map((sx) => ({ grp: 'head', g: SPH, m: ghoul, p: [0.038 * sx, 0.148, 0.117], s: [0.014, 0.011, 0.006] })),
      ...[0, 1, 2, 3, 4].map((k) => ({ grp: 'body', g: BOXG, m: gauze, p: [0, 1.38 - k * 0.11, 0.132], r: [0, 0, k % 2 ? 0.3 : -0.3], s: [0.34, 0.03, 0.01] })),
      ...['legL', 'legR'].flatMap((grp) => [-0.2, -0.45, -0.7].map((y) => ({ grp, g: CYL, m: gauze, p: [0, y, 0], r: [0.2, 0, 0], s: [0.076, 0.03, 0.076] }))),
      ...['armL', 'armR'].flatMap((grp) => [-0.12, -0.3].map((y) => ({ grp, g: CYL, m: gauze, p: [0, y, 0], r: [0, 0, 0.25], s: [0.061, 0.03, 0.061] }))),
      ...['armL', 'armR'].map((grp) => ({ grp, g: BOXG, m: gauze, p: [0.02, -0.62, 0.02], r: [0.3, 0, 0], s: [0.02, 0.18, 0.012] })), // a trailing strip
    ]),
    // Vampire of Sterling Library: high-collared cape with Yale-blue lining, white shirtfront, a brass Y medallion, fangs
    ...only('vampire', [
      { grp: 'body', g: BOXG, m: black, p: [0, 1.0, -0.15], s: [0.5, 1.0, 0.02] },
      { grp: 'body', g: BOXG, m: blue, p: [0, 1.02, -0.135], s: [0.46, 0.95, 0.01] },
      ...[-1, 1].map((sx) => ({ grp: 'body', g: BOXG, m: black, p: [0.11 * sx, 1.62, -0.08], r: [-0.25, 0.45 * sx, 0.3 * sx], s: [0.16, 0.2, 0.012] })),
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.3, 0.128], s: [0.08, 0.26, 0.01] },
      { grp: 'body', g: BOXG, m: red, p: [0, 1.43, 0.135], s: [0.07, 0.025, 0.012] },
      { grp: 'body', g: SPH, m: brass, p: [0, 1.32, 0.14], s: [0.028, 0.028, 0.008] },
      ...[-1, 1].map((sx) => ({ grp: 'head', g: CONE, m: L.white, p: [0.018 * sx, 0.058, 0.104], r: [Math.PI, 0, 0], s: [0.006, 0.022, 0.006] })),
    ]),
    // Witch of Harkness Tower: pointed hat, Yale-blue robe flaring to the floor, a white Y
    ...only('witch', [
      { grp: 'head', g: CYL, m: black, p: [0, 0.235, 0], s: [0.21, 0.012, 0.21] },
      { grp: 'head', g: CONE, m: black, p: [0, 0.42, -0.02], r: [-0.18, 0, 0.08], s: [0.11, 0.36, 0.11] },
      { grp: 'head', g: CYL, m: brass, p: [0, 0.265, 0], s: [0.108, 0.03, 0.108] },
      { grp: 'body', g: SHEET, m: L.shirt, p: [0, 0.6, 0], s: [0.24, 0.82, 0.22], shirt: true },
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.2, 0.133], s: [0.022, 0.09, 0.01] },
      { grp: 'body', g: BOXG, m: L.white, p: [-0.028, 1.285, 0.133], r: [0, 0, 0.55], s: [0.022, 0.1, 0.01] },
      { grp: 'body', g: BOXG, m: L.white, p: [0.028, 1.285, 0.133], r: [0, 0, -0.55], s: [0.022, 0.1, 0.01] },
    ]),
    // Yale Bowl Zombie Slayer: blue helmet with a white stripe and face mask, shoulder pads, white sleeve stripes, #1
    ...only('quarterback', [
      { grp: 'head', g: SPH, m: blue, p: [0, 0.15, -0.005], s: [0.14, 0.15, 0.145] },
      { grp: 'head', g: BOXG, m: L.white, p: [0, 0.24, 0], r: [0.3, 0, 0], s: [0.025, 0.06, 0.24] },
      ...[0.07, 0.11].map((y) => ({ grp: 'head', g: BOXG, m: grey, p: [0, y, 0.14], s: [0.16, 0.012, 0.012] })),
      { grp: 'head', g: BOXG, m: grey, p: [0, 0.09, 0.145], s: [0.012, 0.07, 0.012] },
      { grp: 'body', g: BOXG, m: L.shirt, p: [0, 1.42, 0], s: [0.54, 0.1, 0.3], shirt: true },
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.17, 0.134], s: [0.035, 0.2, 0.01] },
      ...['armL', 'armR'].flatMap((grp) => [-0.06, -0.11].map((y) => ({ grp, g: CYL, m: L.white, p: [0, y, 0], s: [0.058, 0.02, 0.058] }))),
    ]),
    // Headless Whiffenpoof (Yale's a cappella group): white tie and tails, no head... he carries it under his arm
    ...only('whiffenpoof', [
      { grp: 'body', g: CYL, m: L.white, p: [0, 1.47, 0], s: [0.07, 0.05, 0.07] },
      { grp: 'body', g: SPH, m: black, p: [0, 1.5, 0], s: [0.06, 0.012, 0.06] },
      { grp: 'body', g: BOXG, m: L.white, p: [0, 1.25, 0.128], s: [0.11, 0.32, 0.01] },
      ...[-1, 1].map((sx) => ({ grp: 'body', g: BOXG, m: L.white, p: [0.03 * sx, 1.43, 0.14], r: [0, 0, 0.5 * sx], s: [0.05, 0.03, 0.012] })),
      { grp: 'body', g: BOXG, m: L.shirt, p: [0, 0.82, -0.12], s: [0.3, 0.44, 0.03], shirt: true },
      { grp: 'armL', g: SPH, m: L.skin, p: [0.02, -0.46, 0.12], s: [0.1, 0.12, 0.105], skin: true },
      { grp: 'armL', g: SPH, m: L.hair, p: [0.02, -0.4, 0.105], s: [0.105, 0.07, 0.11], hair: true },
      ...[-1, 1].map((sx) => ({ grp: 'armL', g: SPH, m: L.eye, p: [0.02 + 0.035 * sx, -0.44, 0.215], s: [0.016, 0.016, 0.008] })),
      { grp: 'armL', g: BOXG, m: L.dark, p: [0.02, -0.5, 0.217], s: [0.04, 0.012, 0.008] },
    ]),
    // Grim Reaper of Finals Week: hooded black robe, glowing eyes in the dark, and a scythe
    ...only('reaper', [
      { grp: 'head', g: SPH, m: black, p: [0, 0.15, -0.02], s: [0.145, 0.165, 0.15] },
      { grp: 'head', g: SPH, m: std('#000000', { roughness: 1 }), p: [0, 0.12, 0.08], s: [0.08, 0.1, 0.06] },
      ...[-1, 1].map((sx) => ({ grp: 'head', g: SPH, m: ice, p: [0.03 * sx, 0.14, 0.136], s: [0.012, 0.01, 0.006] })),
      { grp: 'body', g: SHEET, m: L.shirt, p: [0, 0.58, 0], s: [0.25, 0.8, 0.23], shirt: true },
      { grp: 'body', g: SPH, m: L.shirt, p: [0, 1.46, -0.04], s: [0.17, 0.08, 0.13], shirt: true },
      { grp: 'armR', g: CYL, m: wood, p: [0, -0.3, 0.07], s: [0.014, 1.6, 0.014] },
      { grp: 'armR', g: BOXG, m: steel, p: [0, 0.46, 0.25], r: [0.25, 0, 0], s: [0.008, 0.07, 0.38] },
    ]),
  ]
}

const ZOMBIE = rigParts({ skin: '#8fa37a', shirt: '#a51c30', pants: '#5c5348', hair: '#2b2620', eye: '#e6f04a', eyeGlow: true, shoe: '#2a2622', letter: 'H' })
const STUDENT = rigParts({ skin: '#ffffff', shirt: '#ffffff', pants: '#ffffff', hair: '#ffffff', eye: '#16100c', shoe: '#e9e6e0', letter: 'Y' }) // white bases: tinted per costume
const SKIN_TONES = ['#f1c9a9', '#d9a97e', '#b98260', '#8d5b3e', '#5e3a26', '#e8b896'].map((c) => new THREE.Color(c))
const HAIR_TONES = ['#1a1412', '#3b2a1e', '#6e4a2c', '#b08a52', '#2a2a2a', '#c45a2a'].map((c) => new THREE.Color(c))

// ---------- pose math
const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _one = new THREE.Vector3(1, 1, 1)
const _zero = new THREE.Vector3(0, 0, 0)
const _up = new THREE.Vector3(0, 1, 0)
const _e = new THREE.Euler(0, 0, 0, 'YXZ')
const _t = new THREE.Matrix4()
const _r = new THREE.Matrix4()
const _m = new THREE.Matrix4()
const G = { root: new THREE.Matrix4(), body: new THREE.Matrix4(), head: new THREE.Matrix4(), armL: new THREE.Matrix4(), armR: new THREE.Matrix4(), legL: new THREE.Matrix4(), legR: new THREE.Matrix4() }
function child(out, parent, px, py, pz, rx = 0, ry = 0, rz = 0) {
  _t.makeTranslation(px, py, pz)
  out.multiplyMatrices(parent, _t)
  if (rx || ry || rz) {
    _e.set(rx, ry, rz, 'YXZ')
    out.multiply(_r.makeRotationFromEuler(_e))
  }
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// a: agent; kind: 'z' | 's'
function poseAgent(meshes, parts, i, a, t, kind) {
  if (!a.on) {
    _m.compose(_zero, _quat.identity(), _zero) // hidden
    for (let j = 0; j < parts.length; j++) meshes[j].setMatrixAt(i, _m)
    return
  }
  const shake = a.flash > 0 ? (Math.random() - 0.5) * 0.08 : 0 // just got hit
  let y = a.y
  let fall = 0
  if (a.down) {
    fall = Math.min(1, a.downT / 0.5)
    if (kind === 'z' && a.downT > DOWN_TIME - 1) y -= (a.downT - (DOWN_TIME - 1)) * 0.6 // sink away
  }
  _pos.set(a.x + shake, y, a.z + shake)
  _quat.setFromAxisAngle(_up, a.yaw)
  G.root.compose(_pos, _quat, _one)
  const ph = t * (kind === 'z' ? 5 : 9) + a.phase
  const walking = a.moving && !a.down
  const bob = walking ? Math.abs(Math.sin(ph)) * 0.03 : 0
  child(G.body, G.root, 0, bob, 0, -fall * (Math.PI / 2) + (kind === 'z' && !a.down ? 0.12 : 0)) // zombies hunch forward
  const swing = walking ? Math.sin(ph) * 0.55 : 0
  child(G.legL, G.body, 0.1, 0.9, 0, swing)
  child(G.legR, G.body, -0.1, 0.9, 0, -swing)
  let la = 0.05 - swing * 0.6
  let ra = 0.05 + swing * 0.6
  let lz = 0.12
  let rz = -0.12
  if (kind === 'z') {
    // arms out in front, clawing when in reach
    la = ra = -1.4 + Math.sin(t * 2 + a.phase) * 0.08
    if (a.attacking) {
      la = -1.6 + Math.sin(t * 10) * 0.5
      ra = -1.6 + Math.sin(t * 10 + 1.5) * 0.5
    }
    lz = 0.05
    rz = -0.05
  } else if (a.attacking) {
    // punch with the right, guard with the left
    ra = -1.5 + Math.max(0, Math.sin(t * 9 + a.phase)) * -0.2
    la = -1.1
    rz = -0.05 + Math.max(0, Math.sin(t * 9 + a.phase)) * 0.15
  }
  child(G.armL, G.body, 0.24, 1.42, 0, la, 0, lz)
  child(G.armR, G.body, -0.24, 1.42, 0, ra, 0, rz)
  const roll = kind === 'z' ? Math.sin(t * 1.3 + a.phase) * 0.25 : 0 // zombie head loll
  child(G.head, G.body, 0, 1.52, 0, kind === 'z' ? 0.15 : 0, 0, roll)
  for (let j = 0; j < parts.length; j++) {
    const pt = parts[j]
    if ((pt.only && !pt.only.includes(a.costume)) || (pt.hideFor && pt.hideFor.includes(a.costume))) {
      _m.compose(_zero, _quat.identity(), _zero) // not part of this student's costume
    } else _m.multiplyMatrices(G[pt.grp], pt.local)
    meshes[j].setMatrixAt(i, _m)
  }
}

// ---------- module state (so App and the chat can bonk, cast, power up, and restart)
const S = {
  zombies: Array.from({ length: MAX_ZOMBIES }, (_, i) => ({ on: false, phase: i * 1.3 })),
  students: Array.from({ length: MAX_STUDENTS }, (_, i) => ({ on: false, phase: i * 0.9, costume: COSTUME_IDS[i % COSTUME_IDS.length] })),
  squad: STUDENTS, // how many student slots are in play
  dan: { cool: { bark: 0, charge: 0, howl: 0 }, level: 1, target: null, dash: 0, x: 0, z: 0, yaw: 0, moving: false },
  wave: 0,
  toSpawn: 0,
  spawnT: 0,
  interlude: 0,
  hp: 100,
  shield: 0,
  spells: 0,
  weapon: null, // { mult, range, left }
  slow: 0, // seconds left of The Long Problem Set
  labubuT: 0, // seconds left to rescue a stolen Labubu (0 = not stolen)
  thiefSent: false, // this wave's thief is out
  kills: 0,
  started: false,
  fx: [], // ground rings: { x, z, r, life, color }
  // the arsenal (see weapons.js)
  endowment: START_ENDOWMENT,
  inv: { briefcase: false, shuriken: false, thermos: 1, takeover: 0, crash: 0 },
  melee: 'wsj',
  ranged: 'thermos', // what L / right click uses (picked on the weapon wheel)
  cool: { melee: 0, card: 0, sic: 0 },
  cards: [], // flying business cards
  thermoses: [], // flying coffee grenades
  crash: 0, // seconds left of a Market Crash
  cleared: false, // between waves (Endowment Office open)
  aim: null, // { i, d }: zombie under the crosshair, up to Hostile Takeover range
  fwd: { x: 0, z: -1 },
  act: { kind: null, at: 0 }, // last thing you did (Hands.jsx animates it)
  hurtT: 0, // throttles the "you got hit" sound
  coffeeT: 0, // seconds until the urn is refilled
  groanT: 3,
  beatT: 0,
}
export { S as RIVALS }

// dev only: inspect the fight from the console
if (import.meta.env.DEV) window.__rivals = S

let bannerTimer
const banner = (text, ms = 2800) => {
  chat.set({ banner: text })
  clearTimeout(bannerTimer)
  bannerTimer = setTimeout(() => chat.set({ banner: null }), ms)
}
export const say = (text, ms) => banner(text, ms)

// the HUD reads these from the store; only push when something visible changed
function pushHud() {
  const hud = {
    hp: Math.ceil(S.hp),
    shield: Math.ceil(S.shield),
    spells: S.spells,
    powerWeapon: S.weapon ? { name: S.weapon.name, left: Math.ceil(S.weapon.left) } : null,
    slowed: Math.ceil(S.slow),
    danLevel: S.dan.level,
    labubuIn: Math.ceil(S.labubuT),
    endowment: S.endowment,
    inv: { ...S.inv },
    melee: S.melee,
    ranged: S.ranged,
    intermission: S.cleared ? Math.ceil(S.interlude) : 0,
    crash: Math.ceil(S.crash),
    coffeeIn: Math.ceil(S.coffeeT),
  }
  const cur = chat.get()
  const changed = Object.keys(hud).some((k) => JSON.stringify(cur[k]) !== JSON.stringify(hud[k]))
  if (changed) chat.set(hud)
}


export function resetRivals() {
  for (const z of S.zombies) z.on = false
  for (const s of S.students) s.on = false
  DAN.golden = false
  Object.assign(S, {
    squad: STUDENTS, wave: 0, toSpawn: 0, spawnT: 0, interlude: 1.5, hp: 100, shield: 0, spells: 0, weapon: null, slow: 0, labubuT: 0, thiefSent: false, kills: 0, started: false, fx: [],
    endowment: START_ENDOWMENT, inv: { briefcase: false, shuriken: false, thermos: 1, takeover: 0, crash: 0 }, melee: 'wsj', ranged: 'thermos', cool: { melee: 0, card: 0, sic: 0 }, cards: [], thermoses: [], crash: 0, cleared: false, coffeeT: 0,
  })
  Object.assign(S.dan, { cool: { bark: 0, charge: 0, howl: 0 }, level: 1, target: null, dash: 0 })
  chat.set({ wave: 0, kills: 0, over: null, zombie: null, note: null, labubuStolen: false })
  pushHud()
}

// ---------- power-ups (earned from the professors; ids match backend/quiz.py)
const POWER_UPS = {
  labubu_chainsaw: () => (S.weapon = { name: 'Labubu Chainsaw', mult: 4, range: 3.8, left: 40 }),
  regression_ray: () => (S.weapon = { name: 'Regression Ray', mult: 3, range: 5, left: 45 }),
  token_storm: () => (S.spells += 2),
  hallucination_hex: () => (S.spells += 3),
  bell_curve_blast: () => (S.spells += 2),
  overfit_shield: () => (S.shield += 60),
  confidence_interval_shield: () => (S.shield += 80),
  plain_english_potion: () => (S.hp = Math.min(100, S.hp + 60)),
  long_problem_set: () => (S.slow = 25),
  agent_army: () => {
    S.squad = Math.min(MAX_STUDENTS, S.squad + 4)
    S.started = false // re-rally: the new students run in next frame
  },
}
export function applyPowerUp(pu) {
  POWER_UPS[pu.id]?.()
  pushHud()
  banner(`⚡ ${pu.name}: ${pu.description}`, 3600)
}

// spell: every zombie near you gets blasted and knocked back
export function castSpell() {
  const p = S.player
  if (!p || S.spells <= 0 || chat.get().over) return false
  S.spells -= 1
  for (const z of S.zombies) {
    if (!z.on || z.down) continue
    const dx = z.x - p.x
    const dz = z.z - p.z
    const d = Math.hypot(dx, dz)
    if (d > SPELL_RADIUS) continue
    z.hp -= SPELL_DAMAGE
    z.flash = 0.3
    z.stun = Math.max(z.stun || 0, 1)
    const push = (SPELL_RADIUS - d) * 0.35
    z.x += (dx / (d || 1)) * push
    z.z += (dz / (d || 1)) * push
  }
  S.fx.push({ x: p.x, z: p.z, r: SPELL_RADIUS, life: 0.6, max: 0.6, color: '#ff4fa3' })
  pushHud()
  return true
}

const act = (kind) => (S.act = { kind, at: performance.now() })
const hostile = (z) => z.on && !z.down && !(z.ally > 0)
const canAct = () => S.player && !chat.get().over && chat.get().simRunning

// melee: swing the equipped weapon at whatever's in front of you (no precise aim needed)
export function meleeAttack() {
  if (!canAct() || S.cool.melee > 0) return
  const w = MELEE[S.melee]
  S.cool.melee = w.cooldown
  act('melee')
  const p = S.player
  const range = Math.max(w.range, S.weapon?.range || 0)
  const hits = S.zombies
    .filter(hostile)
    .map((z) => {
      const dx = z.x - p.x
      const dz = z.z - p.z
      const d = Math.hypot(dx, dz)
      return { z, d, front: (dx * S.fwd.x + dz * S.fwd.z) / (d || 1) }
    })
    .filter((h) => h.d <= range && h.front > 0.7) // within ~45° of where you're looking
    .sort((a, b) => a.d - b.d)
    .slice(0, S.melee === 'briefcase' ? 3 : 1) // the briefcase swing catches a few
  for (const { z, d } of hits) {
    z.hp -= w.damage * (S.weapon?.mult || 1)
    z.flash = 0.25
    z.stun = Math.max(z.stun || 0, w.stun)
    z.x += ((z.x - p.x) / (d || 1)) * w.knock
    z.z += ((z.z - p.z) / (d || 1)) * w.knock
  }
  if (hits.length) sfx.hit(S.melee === 'briefcase')
  else sfx.whoosh()
}

// ranged: flick a business card along your line of sight
export function throwCard() {
  if (!canAct() || !S.inv.shuriken || S.cool.card > 0) return
  S.cool.card = SHURIKEN.cooldown
  act('card')
  const p = S.player
  S.cards.push({ x: p.x + S.fwd.x * 0.5, z: p.z + S.fwd.z * 0.5, vx: S.fwd.x * SHURIKEN.speed, vz: S.fwd.z * SHURIKEN.speed, left: SHURIKEN.range / SHURIKEN.speed, hits: new Set(), y: S.eyeY - 0.25 })
  sfx.whoosh()
}

export function throwThermos() {
  if (!canAct() || S.inv.thermos <= 0) return
  S.inv.thermos -= 1
  act('thermos')
  const p = S.player
  S.thermoses.push({ x: p.x + S.fwd.x * 0.6, y: S.eyeY - 0.2, z: p.z + S.fwd.z * 0.6, vx: S.fwd.x * THERMOS.speed, vy: 3.5 + S.pitch * THERMOS.speed, vz: S.fwd.z * THERMOS.speed, spin: 0 })
  sfx.whoosh()
  pushHud()
}

export function hostileTakeover() {
  if (!canAct() || S.inv.takeover <= 0) return
  const z = S.aim && S.zombies[S.aim.i]
  if (!z || !hostile(z) || S.aim.d > TAKEOVER.range) return banner('🤝 Aim at a zombie (within 16 m) to stage a Hostile Takeover.', 2200)
  S.inv.takeover -= 1
  act('takeover')
  z.ally = TAKEOVER.time
  z.hp = Math.max(z.hp, 6)
  if (z.thief) {
    if (z.thief.carrying) {
      rescueLabubu()
      banner('💗 Takeover! The thief hands the Labubu back to Prof. Zaman.')
    }
    z.thief = null
  } else banner('🤝 Hostile Takeover! That zombie fights for Yale now.', 2200)
  S.fx.push({ x: z.x, z: z.z, r: 1.6, life: 0.6, max: 0.6, color: '#4aa3ff' })
  pushHud()
}

export function marketCrash() {
  if (!canAct() || S.inv.crash <= 0 || S.crash > 0) return
  S.inv.crash -= 1
  S.crash = CRASH.time
  act('crash')
  banner("📉 MARKET CRASH! Harvard's stock is in free fall.", 3000)
  sfx.boom()
  pushHud()
}

// coffee: the healing station. Aim at the snack table and press E / click.
export function drinkCoffee() {
  if (!canAct()) return
  if (S.coffeeT > 0) return banner(`☕ The urn is refilling: ${Math.ceil(S.coffeeT)}s.`, 1600)
  if (S.hp >= 100) return banner("☕ You're at full health. Save the coffee for when you need it.", 1800)
  S.hp = Math.min(100, S.hp + COFFEE.heal)
  S.coffeeT = COFFEE.refill
  act('drink')
  banner(`☕ Ahh. Coffee and a donut: +${COFFEE.heal} health.`, 1800)
  pushHud()
}

// Q: point Handsome Dan at the zombie you're aiming at
export function sicEm() {
  if (!canAct() || S.cool.sic > 0) return
  const z = S.aim && S.zombies[S.aim.i]
  if (!z || !hostile(z)) return
  S.cool.sic = 2
  S.dan.target = z
  S.dan.dash = 0.5
  banner("🐶 Sic 'em, Dan!", 1200)
}

// ---------- the weapon wheel: melee options, and the long-range slot (L / right click)
export const RANGED = {
  cards: { name: 'Business Cards', icon: '📇', have: () => S.inv.shuriken, count: () => null, use: () => throwCard() },
  thermos: { name: 'Coffee Thermos', icon: '☕', have: () => S.inv.thermos > 0, count: () => S.inv.thermos, use: () => throwThermos() },
  takeover: { name: 'Hostile Takeover', icon: '🤝', have: () => S.inv.takeover > 0, count: () => S.inv.takeover, use: () => hostileTakeover() },
  crash: { name: 'Market Crash', icon: '📉', have: () => S.inv.crash > 0, count: () => S.inv.crash, use: () => marketCrash() },
  spell: { name: 'Professor Spell', icon: '✨', have: () => S.spells > 0, count: () => S.spells, use: () => castSpell() },
}
export function useRanged() {
  const r = RANGED[S.ranged]
  if (r?.have()) return r.use()
  // out of the selected one: fall back to whatever you still have
  const next = Object.keys(RANGED).find((k) => RANGED[k].have())
  if (next) {
    S.ranged = next
    pushHud()
    RANGED[next].use()
  } else banner('🎯 Nothing to throw. Buy some at the Endowment Office between waves.', 2000)
}
// what the wheel shows right now: [{ id, kind, name, icon, count, ready }]
export function wheelOptions() {
  return [
    ...Object.entries(MELEE).map(([id, w]) => ({ id, kind: 'melee', name: w.name, icon: w.icon, count: null, ready: id === 'wsj' || !!S.inv[id], on: S.melee === id })),
    ...Object.entries(RANGED).map(([id, r]) => ({ id, kind: 'ranged', name: r.name, icon: r.icon, count: r.count(), ready: !!r.have(), on: S.ranged === id })),
  ]
}
export function equip(id) {
  if (MELEE[id]) return equipMelee(id)
  if (RANGED[id]?.have()) {
    S.ranged = id
    pushHud()
  }
}

export function equipMelee(id) {
  if (MELEE[id] && (id === 'wsj' || S.inv[id])) {
    S.melee = id
    pushHud()
  }
}

// the Endowment Office: open before the first wave and between waves
export const canShop = () => S.wave === 0 || (S.toSpawn === 0 && !S.zombies.some((z) => z.on && !z.down))
export function buy(id) {
  const melee = MELEE[id]
  const price = melee ? melee.price : id === 'shuriken' ? SHURIKEN.price : ITEMS[id]?.price
  if (price == null || S.endowment < price || !canShop()) return false
  if ((melee || id === 'shuriken') && S.inv[id]) return false // already own it
  S.endowment -= price
  if (melee) {
    S.inv[id] = true
    S.melee = id
  } else if (id === 'shuriken') {
    S.inv.shuriken = true
    S.ranged = 'cards' // ready to throw
  }
  else S.inv[id] += 1
  sfx.coin()
  pushHud()
  return true
}
export function startNextWave() {
  if (S.cleared) S.interlude = 0.01
}

// a cloister point between lo and hi meters from p
function ringPoint(p, lo, hi) {
  const ok = RING.filter((q) => {
    const d = Math.hypot(q[0] - p.x, q[1] - p.z)
    return d >= lo && d <= hi
  })
  const pool = ok.length ? ok : RING
  const q = pool[Math.floor(Math.random() * pool.length)]
  return { x: q[0] + (Math.random() - 0.5) * 1.5, z: q[1] + (Math.random() - 0.5) * 1.5 }
}

// ---------- navigation. The cloister loop (RING) is the walkable spine of the floor: roamers follow it one
// waypoint at a time, and anyone whose straight line to a target is blocked goes around by it. A straight
// line between two far-apart loop points cuts through the courtyard glass and the classroom drums, which
// is what used to get people stuck.
const RN = RING.length
const BLOCKERS = COLLIDERS.filter((w) => w.y0 < 1.2) // anything at body height: walls, and benches you can't walk through
const ringStep = (i, d) => (i + d + RN) % RN
const ringDir = (from, to) => ((to - from + RN) % RN <= RN / 2 ? 1 : -1)
// a point on the loop, shifted sideways into this agent's lane so they don't walk single file
function lanePt(i, lane = 0) {
  const q = RING[i]
  const l = Math.hypot(q[0], q[1]) || 1
  return [q[0] + (q[0] / l) * lane, q[1] + (q[1] / l) * lane]
}
function segPoint(px, pz, ax, az, bx, bz) {
  const dx = bx - ax
  const dz = bz - az
  const l2 = dx * dx + dz * dz
  const u = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0
  return Math.hypot(px - (ax + dx * u), pz - (az + dz * u))
}
function segSeg(ax, az, bx, bz, cx, cz, dx, dz) {
  const cross = (ux, uz, vx, vz) => ux * vz - uz * vx
  const d1 = cross(bx - ax, bz - az, cx - ax, cz - az)
  const d2 = cross(bx - ax, bz - az, dx - ax, dz - az)
  const d3 = cross(dx - cx, dz - cz, ax - cx, az - cz)
  const d4 = cross(dx - cx, dz - cz, bx - cx, bz - cz)
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0 // they cross
  return Math.min(segPoint(ax, az, cx, cz, dx, dz), segPoint(bx, bz, cx, cz, dx, dz), segPoint(cx, cz, ax, az, bx, bz), segPoint(dx, dz, ax, az, bx, bz))
}
// is the straight walk from a to b free of walls and furniture? (bodies are ~0.3 m wide)
function clearPath(ax, az, bx, bz) {
  const minx = Math.min(ax, bx) - 0.6
  const maxx = Math.max(ax, bx) + 0.6
  const minz = Math.min(az, bz) - 0.6
  const maxz = Math.max(az, bz) + 0.6
  for (const w of BLOCKERS) {
    if (w.maxx < minx || w.minx > maxx || w.maxz < minz || w.minz > maxz) continue
    if (segSeg(ax, az, bx, bz, w.a[0], w.a[1], w.b[0], w.b[1]) < w.t / 2 + 0.3) return false
  }
  return true
}
// patrol: walk the loop waypoint by waypoint, now and then turning back
function followRing(a, speed, dt) {
  if (a.ri == null) a.ri = nearestRing([a.x, a.z])
  // skip waypoints that sit inside furniture (a bench in the middle of the cloister, a planter...)
  for (let k = 0; k < 4 && wallAt(...lanePt(a.ri, a.lane), 0.5, 0.45); k++) a.ri = ringStep(a.ri, a.dir || 1)
  // something between you and the next waypoint (a planter on the centerline)? switch lanes to pass it
  a.wpT = (a.wpT ?? 0) - dt
  if (a.wpT <= 0) {
    a.wpT = 0.4
    if (!clearPath(a.x, a.z, ...lanePt(a.ri, a.lane))) {
      const other = (a.lane || 0) > 0 ? -1.3 : 1.3
      if (clearPath(a.x, a.z, ...lanePt(a.ri, other))) a.lane = other
      else a.ri = ringStep(a.ri, a.dir || 1)
    }
  }
  const [wx, wz] = lanePt(a.ri, a.lane)
  if (Math.hypot(wx - a.x, wz - a.z) < 1.4) {
    a.ri = ringStep(a.ri, a.dir || 1)
    if (Math.random() < 0.02) a.dir = -(a.dir || 1)
  }
  step(a, wx, wz, speed, dt, 0)
}
// head for (tx, tz): straight if nothing's in the way, otherwise around the cloister toward it
function navTo(a, tx, tz, speed, dt, stopAt) {
  a.losT = (a.losT ?? 0) - dt
  if (a.losT <= 0) {
    a.losT = 0.35
    a.los = clearPath(a.x, a.z, tx, tz)
  }
  if (a.los) return step(a, tx, tz, speed, dt, stopAt)
  if (a.ri == null) a.ri = nearestRing([a.x, a.z])
  a.dir = ringDir(a.ri, nearestRing([tx, tz]))
  followRing(a, speed, dt)
  return Infinity
}
// no progress for 1 s: reroute (turn around on the loop, other lane); still stuck after that: step back onto the loop.
// Boxed in by teammates instead? Turning around just walks into the next one, so give way: pause, change lanes.
function unstick(a, dt, crowded = false) {
  a.stuckT = (a.stuckT ?? 0) + dt
  if (a.stuckT < 1) return
  a.stuckT = 0
  const moved = a.lx == null ? 99 : Math.hypot(a.x - a.lx, a.z - a.lz)
  a.lx = a.x
  a.lz = a.z
  if (!a.moving || moved > 0.3) {
    a.stuckN = 0
    return
  }
  if (crowded) {
    a.yieldT = 0.3 + Math.random() * 0.7
    a.lane = (Math.random() - 0.5) * 2.4
    a.los = false
    return
  }
  a.stuckN = (a.stuckN || 0) + 1
  a.ri = nearestRing([a.x, a.z])
  a.dir = -(a.dir || 1)
  a.lane = (Math.random() - 0.5) * 2.4 // try another lane around whatever's in the way
  a.los = false
  a.losT = 1
  if (a.stuckN >= 3) {
    ;[a.x, a.z] = lanePt(a.ri, 0)
    a.stuckN = 0
  }
}
const navInit = () => ({ ri: null, dir: Math.random() < 0.5 ? -1 : 1, lane: (Math.random() - 0.5) * 1.8, los: false, losT: 0, stuckT: Math.random() * 1.5, stuckN: 0, lx: null, lz: null })

function spawnStudent(s, p, near = true) {
  // spread out around the halls (not one clump next to you), a few meters from any teammate
  let at
  for (let k = 0; k < 10; k++) {
    at = near ? ringPoint(p, 3, 45) : ringPoint(p, 5, 45)
    if (!S.students.some((o) => o !== s && o.on && Math.hypot(o.x - at.x, o.z - at.z) < 2.5)) break
  }
  Object.assign(s, { on: true, x: at.x, z: at.z, y: 0, yaw: 0, hp: 5, down: false, downT: 0, moving: false, attacking: false, cool: 0, flash: 0, pace: 0.8 + Math.random() * 0.5, target: null, yieldT: 0, side: Math.random() * 2 - 1, ...navInit() })
}

function spawnZombie(p, thief) {
  const z = S.zombies.find((q) => !q.on)
  if (!z) return false
  const at = ringPoint(p, 16, 34)
  Object.assign(z, { on: true, x: at.x, z: at.z, y: 0, yaw: 0, hp: 4 + S.wave * 0.6, down: false, downT: 0, moving: true, attacking: false, flash: 0, stun: 0, retarget: 0, target: null, thief: null, stalker: Math.random() < STALKER_SHARE, age: 0, ...navInit() })
  if (thief) {
    // heads around the cloister, in through 2200's door, to Prof. Zaman
    const R = ZAMAN_ROOM
    z.thief = { carrying: false, i: 0, path: [...ringPath(nearestRing([z.x, z.z]), R.ring), R.outer, R.inner, null] } // null = Zaman himself
    banner('🧟 A Harvard zombie is going for Prof. Zaman’s Labubu! Stop it before it gets to room 2200!', 3600)
  }
  return true
}

const CENTER = new THREE.Vector2(0, 0)
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const _p = { x: 0, z: 0 }
const _fwd = new THREE.Vector3()

// is there a wall (or furniture) at this point and height? Projectiles fly over benches and desks.
function wallAt(x, z, y, r = 0.08) {
  for (const w of COLLIDERS) {
    if (y < w.y0 || y > w.y0 + w.h) continue
    const rr = r + w.t / 2
    if (x < w.minx - rr || x > w.maxx + rr || z < w.minz - rr || z > w.maxz + rr) continue
    const dx = w.b[0] - w.a[0]
    const dz = w.b[1] - w.a[1]
    const l2 = dx * dx + dz * dz
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - w.a[0]) * dx + (z - w.a[1]) * dz) / l2)) : 0
    if (Math.hypot(x - (w.a[0] + dx * u), z - (w.a[1] + dz * u)) < rr) return true
  }
  return false
}

function step(a, tx, tz, speed, dt, stopAt) {
  const dx = tx - a.x
  const dz = tz - a.z
  const d = Math.hypot(dx, dz)
  a.yaw += wrap(Math.atan2(dx, dz) - a.yaw) * Math.min(1, dt * 8)
  if (d <= stopAt) {
    a.moving = false
    return d
  }
  const k = Math.min(speed * dt, d - stopAt) / d
  _p.x = a.x + dx * k
  _p.z = a.z + dz * k
  collide(_p, 1) // slide along walls
  a.x = _p.x
  a.z = _p.z
  a.moving = true
  return d
}

function rescueLabubu() {
  S.labubuT = 0
  chat.set({ labubuStolen: false })
}

// the thief runs for the point on the cloister loop farthest from you
function fleePath(from, p) {
  let far = 0
  RING.forEach((q, i) => {
    if (Math.hypot(q[0] - p.x, q[1] - p.z) > Math.hypot(RING[far][0] - p.x, RING[far][1] - p.z)) far = i
  })
  return ringPath(from, far)
}

function killZombie(z) {
  if (!(z.ally > 0)) {
    S.endowment += bounty(S.wave, !!z.thief) // allies that collapse don't pay out
  }
  z.ally = 0
  z.down = true
  z.downT = 0
  z.attacking = false
  z.moving = false
  S.kills += 1
  if (z.thief?.carrying) {
    rescueLabubu()
    banner('💗 Labubu rescued! Back to Prof. Zaman it goes.')
  }
  z.thief = null
  const lvl = danLevel(S.kills)
  if (lvl > S.dan.level) {
    S.dan.level = lvl
    const L = DAN_LEVELS[lvl - 1]
    banner(`🐶 Handsome Dan reached level ${lvl}: ${L.icon} ${L.name}!`, 3200)
    if (lvl === 5) DAN.golden = true
  }
  chat.set({ kills: S.kills })
}

function paperTex() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 160
  const g = c.getContext('2d')
  g.fillStyle = '#fff7df'
  g.fillRect(8, 8, 112, 144)
  g.strokeStyle = '#ff4fa3'
  g.lineWidth = 4
  g.strokeRect(8, 8, 112, 144)
  g.fillStyle = '#9aa3b2'
  for (let y = 40; y < 140; y += 16) g.fillRect(22, y, 84 - (y % 32 ? 20 : 0), 4)
  g.fillStyle = '#c8102e'
  g.font = 'bold 22px Georgia, serif'
  g.fillText('NOTE', 34, 32)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function glowTex(color) {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const g = c.getContext('2d')
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, '#ffffff')
  r.addColorStop(0.3, color)
  r.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const CARD_GEO = new THREE.BoxGeometry(0.09, 0.004, 0.055)
const CARD_MAT = new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.35 })
const THERMOS_GEO = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 12)
const THERMOS_MAT = new THREE.MeshStandardMaterial({ color: '#b9bec6', metalness: 0.85, roughness: 0.3 })
const _o = new THREE.Object3D()

function vendingTex() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = '#0b0f1c'
  g.fillRect(0, 0, 256, 512)
  g.fillStyle = '#00356b'
  g.fillRect(0, 0, 256, 92)
  g.fillStyle = '#ffd76a'
  g.font = 'bold 26px Georgia, serif'
  g.textAlign = 'center'
  g.fillText('ENDOWMENT', 128, 42)
  g.fillText('OFFICE', 128, 76)
  const rows = ['🗞️ 💼 📇', '☕ 🤝 📉']
  g.font = '44px system-ui'
  rows.forEach((r, i) => g.fillText(r, 128, 180 + i * 90))
  g.fillStyle = '#ff4fa3'
  g.font = 'bold 22px system-ui'
  g.fillText('$ press B between waves', 128, 400, 230)
  g.strokeStyle = '#ffd76a'
  g.lineWidth = 6
  g.strokeRect(6, 6, 244, 500)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// a glowing vending machine against Ross Library's north wall: a beacon in the dark
function VendingMachine({ innerRef }) {
  const front = useMemo(() => new THREE.MeshBasicMaterial({ map: vendingTex(), toneMapped: false }), [])
  return (
    <group ref={innerRef} position={[VENDING.x, 0, VENDING.z]} rotation={[0, VENDING.rot, 0]}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.95, 1.9, 0.7]} />
        <meshStandardMaterial color="#1c2233" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.0, 0.352]} material={front}>
        <planeGeometry args={[0.82, 1.64]} />
      </mesh>
      <pointLight position={[0, 1.2, 0.9]} color="#ffd76a" intensity={6} distance={6} decay={2} />
    </group>
  )
}

function signTex() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')
  g.fillStyle = '#1a120c'
  g.fillRect(0, 0, 512, 160)
  g.strokeStyle = '#c9a44a'
  g.lineWidth = 6
  g.strokeRect(6, 6, 500, 148)
  g.fillStyle = '#ffd9a0'
  g.textAlign = 'center'
  g.font = 'bold 54px Georgia, serif'
  g.fillText('☕ Coffee & Snacks', 256, 76)
  g.font = '28px Georgia, serif'
  g.fillStyle = '#e8c9a0'
  g.fillText(`fuel up: +${COFFEE.heal} health`, 256, 124)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// the healing station: a coffee urn, cups, and a tray of donuts and bagels under a warm light. Steam rises
// while the urn is full; it stops while it refills.
function CoffeeTable({ innerRef }) {
  const M = useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: '#6b4426', roughness: 0.6 }),
      steel: new THREE.MeshStandardMaterial({ color: '#c3c8cf', metalness: 0.9, roughness: 0.25 }),
      black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.5 }),
      cup: new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 }),
      tray: new THREE.MeshStandardMaterial({ color: '#2b2b2f', roughness: 0.4 }),
      dough: new THREE.MeshStandardMaterial({ color: '#c98a4a', roughness: 0.8 }),
      pink: new THREE.MeshStandardMaterial({ color: '#ff8fc7', roughness: 0.6 }),
      choc: new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.6 }),
      bagel: new THREE.MeshStandardMaterial({ color: '#d9b27a', roughness: 0.85 }),
      sign: new THREE.MeshBasicMaterial({ map: signTex(), toneMapped: false }),
      steam: new THREE.SpriteMaterial({ map: glowTex('#e8eef5'), transparent: true, depthWrite: false, opacity: 0.35 }),
    }),
    [],
  )
  const steam = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const ready = S.coffeeT <= 0
    steam.current.forEach((sp, k) => {
      if (!sp) return
      const life = (t * 0.5 + k / 4) % 1
      sp.visible = ready
      sp.position.set(-0.45 + Math.sin(t + k) * 0.03, 1.32 + life * 0.5, 0.05)
      sp.scale.setScalar(0.08 + life * 0.18)
      sp.material.opacity = 0.35 * (1 - life)
    })
  })
  const donut = (x, z, m) => (
    <group key={`${x}${z}`} position={[x, 0.85, z]}>
      <mesh geometry={DONUT} material={M.dough} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={DONUT} material={m} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} scale={[1, 1, 0.5]} />
    </group>
  )
  return (
    <group ref={innerRef} position={[COFFEE.x, 0, COFFEE.z]}>
      {/* table */}
      <mesh position={[0, 0.76, 0]} material={M.wood} castShadow receiveShadow>
        <boxGeometry args={[1.7, 0.05, 0.75]} />
      </mesh>
      {[-0.78, 0.78].flatMap((x) => [-0.32, 0.32].map((z) => (
        <mesh key={`${x}${z}`} position={[x, 0.37, z]} material={M.wood}>
          <boxGeometry args={[0.05, 0.74, 0.05]} />
        </mesh>
      )))}
      {/* coffee urn with spigot */}
      <mesh position={[-0.45, 0.82, 0]} material={M.black}>
        <cylinderGeometry args={[0.15, 0.17, 0.08, 20]} />
      </mesh>
      <mesh position={[-0.45, 1.06, 0]} material={M.steel}>
        <cylinderGeometry args={[0.13, 0.13, 0.42, 20]} />
      </mesh>
      <mesh position={[-0.45, 1.29, 0]} material={M.black}>
        <sphereGeometry args={[0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position={[-0.45, 0.94, 0.15]} rotation={[Math.PI / 2, 0, 0]} material={M.black}>
        <cylinderGeometry args={[0.015, 0.015, 0.07, 8]} />
      </mesh>
      {/* stacked cups */}
      {[0, 1, 2].map((k) => (
        <mesh key={k} position={[-0.1, 0.83 + k * 0.035, -0.12]} material={M.cup}>
          <cylinderGeometry args={[0.042, 0.032, 0.1, 14, 1, true]} />
        </mesh>
      ))}
      <mesh position={[0.05, 0.83, 0.1]} material={M.cup}>
        <cylinderGeometry args={[0.042, 0.032, 0.1, 14]} />
      </mesh>
      {/* tray of donuts and bagels */}
      <mesh position={[0.45, 0.795, 0]} material={M.tray}>
        <boxGeometry args={[0.6, 0.02, 0.42]} />
      </mesh>
      {donut(0.3, -0.1, M.pink)}
      {donut(0.45, -0.1, M.choc)}
      {donut(0.6, -0.1, M.pink)}
      {donut(0.37, 0.1, M.choc)}
      {[0.52, 0.66].map((x) => (
        <mesh key={x} geometry={DONUT} material={M.bagel} rotation={[Math.PI / 2, 0, 0]} position={[x, 0.85, 0.1]} scale={1.2} />
      ))}
      {/* sign + a warm light: a beacon in the dark */}
      <mesh position={[0, 1.55, -0.3]} material={M.sign}>
        <planeGeometry args={[1.2, 0.375]} />
      </mesh>
      <pointLight position={[0, 1.4, 0.6]} color="#ffb870" intensity={5} distance={6} decay={2} />
      {Array.from({ length: 4 }, (_, k) => (
        <sprite key={k} ref={(el) => (steam.current[k] = el)} material={M.steam.clone()} />
      ))}
    </group>
  )
}
const DONUT = new THREE.TorusGeometry(0.045, 0.022, 10, 18)

export default function Rivals() {
  const { camera } = useThree()
  const zMeshes = useRef([])
  const sMeshes = useRef([])
  const notes = useRef([])
  const rings = useRef([])
  const thiefLabubu = useRef()
  const thiefMark = useRef()
  const cardMesh = useRef()
  const thermosMesh = useRef()
  const allyMarks = useRef([])
  const vending = useRef()
  const coffee = useRef()
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const tex = useMemo(() => ({ paper: paperTex(), red: glowTex('#ff3b3b'), blue: glowTex('#4aa3ff') }), [])
  const frame = useRef(0)

  useLayoutEffect(() => {
    for (const mesh of [...zMeshes.current, ...sMeshes.current]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 500)
      mesh.castShadow = true
      mesh.receiveShadow = true
    }
    // students: a mix of skin and hair colors (instance color multiplies a white material)
    const tint = new THREE.Color()
    STUDENT.forEach((pt, j) => {
      for (let i = 0; i < MAX_STUDENTS; i++) {
        const c = COSTUMES[S.students[i].costume]
        if (pt.skin) sMeshes.current[j].setColorAt(i, SKIN_TONES[(i * 7) % SKIN_TONES.length])
        else if (pt.hair) sMeshes.current[j].setColorAt(i, HAIR_TONES[(i * 5) % HAIR_TONES.length])
        else if (pt.shirt) sMeshes.current[j].setColorAt(i, tint.set(c.shirt))
        else if (pt.pants) sMeshes.current[j].setColorAt(i, tint.set(c.pants))
      }
    })
    resetRivals()
    return () => chat.set({ zombie: null, note: null, banner: null, labubuStolen: false })
  }, [])

  useFrame(({ clock }, rawDt) => {
    const st = chat.get()
    const dt = Math.min(rawDt, 0.05) * (st.wheelOpen ? 0.15 : 1) // the weapon wheel slows time to a crawl
    const t = clock.elapsedTime
    const running = st.simRunning && !st.over
    const p = { x: camera.position.x, z: camera.position.z }
    S.player = p
    sfx.ambience(running) // the drone fades in while you're fighting, out when paused
    camera.getWorldDirection(_fwd)
    S.pitch = _fwd.y
    const fl = Math.hypot(_fwd.x, _fwd.z) || 1
    S.fwd = { x: _fwd.x / fl, z: _fwd.z / fl }
    S.eyeY = camera.position.y
    const dan = S.dan

    if (running) {
      // the squad rallies to you (again after Agent Army); Dan comes to heel
      if (!S.started) {
        S.started = true
        S.students.forEach((s, i) => {
          if (i < S.squad && !s.on) spawnStudent(s, p)
        })
        if (!dan.placed) Object.assign(dan, { x: DAN.x, z: DAN.z, yaw: DAN.yaw, placed: true })
      }

      // timers on power-ups
      if (S.weapon && (S.weapon.left -= dt) <= 0) S.weapon = null
      S.slow = Math.max(0, S.slow - dt)

      // waves: bigger and tougher each time
      const alive = S.zombies.filter((z) => z.on).length
      if (S.toSpawn === 0 && alive === 0) {
        if (S.wave > 0 && !S.cleared) {
          S.cleared = true
          S.interlude = INTERMISSION
          banner(`✅ Wave ${S.wave} cleared! The Endowment Office is open: press B (or visit the vending machine by Ross Library).`, 5000)
        }
        S.interlude -= dt
        if (S.interlude <= 0) {
          S.cleared = false
          S.wave += 1
          S.toSpawn = 6 + S.wave * 4 // a bigger Yale squad needs a bigger Harvard horde
          S.interlude = 4
          S.thiefSent = false
          if (st.labubuStolen) chat.set({ labubuStolen: false }) // Zaman got a new one
          chat.set({ wave: S.wave })
          banner(S.wave === 1 ? '🧟 Harvard zombies are in the cloister! Defend Evans Hall!' : `🧟 Wave ${S.wave}: Harvard sends ${S.toSpawn} more`)
        }
      }
      if (S.toSpawn > 0) {
        S.spawnT -= dt
        const thief = S.wave >= 2 && !S.thiefSent && !st.labubuStolen && ZAMAN.ready
        if (S.spawnT <= 0 && spawnZombie(p, thief)) {
          if (thief) S.thiefSent = true
          S.toSpawn -= 1
          S.spawnT = 0.6
        }
      }

      // timers on your gear
      for (const k in S.cool) S.cool[k] = Math.max(0, S.cool[k] - dt)
      S.hurtT = Math.max(0, (S.hurtT || 0) - dt)
      S.coffeeT = Math.max(0, S.coffeeT - dt)
      S.crash = Math.max(0, S.crash - dt)
      const zSpeed = (Z_SPEED + S.wave * 0.05) * (S.slow > 0 ? 0.3 : 1) * (S.crash > 0 ? CRASH.slow : 1)

      // zombies
      for (const z of S.zombies) {
        if (!z.on) continue
        z.flash = Math.max(0, z.flash - dt)
        if (z.down) {
          z.downT += dt
          if (z.downT > DOWN_TIME) z.on = false
          continue
        }
        if (z.burn > 0) {
          z.burn -= dt // scalded by a coffee thermos
          z.hp -= THERMOS.burn * dt
        }
        if (S.crash > 0 && !(z.ally > 0)) z.hp -= CRASH.dps * dt
        if (z.hp <= 0) {
          killZombie(z)
          continue
        }
        if (z.stun > 0) {
          z.stun -= dt
          z.moving = z.attacking = false
          continue
        }
        if (z.ally > 0) {
          // taken over: fights the nearest hostile zombie until its time runs out, then collapses
          z.ally -= dt
          if (z.ally <= 0) {
            z.hp = 0
            continue
          }
          let foe = null
          let bd = 20
          for (const o of S.zombies) {
            if (o === z || !hostile(o)) continue
            const d = dist(z, o)
            if (d < bd) {
              bd = d
              foe = o
            }
          }
          if (foe) {
            const d = navTo(z, foe.x, foe.z, zSpeed * 1.3 + 0.8, dt, REACH * 0.9)
            z.attacking = d <= REACH
            if (z.attacking) {
              foe.hp -= 1.5 * dt
              foe.flash = 0.1
            }
          } else {
            z.attacking = false
            if (dist(z, p) > 4) navTo(z, p.x, p.z, 2, dt, 2.5)
            else z.moving = false
          }
          z.y = floorAt(z.x, z.z)
          continue
        }
        if (z.thief) {
          // the Labubu heist: follow the route in, grab it, follow the route back out
          const th = z.thief
          const wp = th.path[th.i]
          const tx = wp ? wp[0] : ZAMAN.x
          const tz = wp ? wp[1] : ZAMAN.z
          const d = step(z, tx, tz, zSpeed * (th.carrying ? 1.5 : 1.25), dt, wp ? 0 : 0.6)
          z.attacking = false
          if (d < 0.45 || (!wp && d <= 0.7)) {
            if (th.i < th.path.length - 1) th.i += 1
            else if (!th.carrying) {
              th.carrying = true
              S.labubuT = LABUBU_TIME
              chat.set({ labubuStolen: true })
              banner(`😱 The zombie grabbed Prof. Zaman’s Labubu! Get it back in ${LABUBU_TIME} seconds or Harvard wins!`, 4000)
              sfx.stinger(true) // the alarm
              // escape route: back out the door, then the far side of the cloister from you
              th.path = [ZAMAN_ROOM.inner, ZAMAN_ROOM.outer, ...fleePath(ZAMAN_ROOM.ring, p)]
              th.i = 0
            } else {
              // reached the far side: keep running, away from you again
              th.path = fleePath(nearestRing([z.x, z.z]), p)
              th.i = 0
            }
          }
          z.y = floorAt(z.x, z.z)
          continue
        }
        z.age += dt
        z.retarget -= dt
        if (z.retarget <= 0 || (z.target && z.target !== p && (z.target.down || !z.target.on))) {
          z.retarget = 0.5 + Math.random() * 0.4
          // stalkers (and everyone, once a wave drags on) come for you; the rest hunt what they notice
          const stalking = z.stalker || z.age > STALK_AFTER
          let best = stalking || dist(z, p) < SIGHT_Z ? p : null
          let bd = stalking ? Infinity : best ? dist(z, p) : SIGHT_Z
          if (stalking) bd = dist(z, p)
          for (const s of S.students) {
            if (!s.on || s.down) continue
            const d = dist(z, s)
            if (d < bd) {
              bd = d
              best = s
            }
          }
          for (const o of S.zombies) {
            if (!(o.on && !o.down && o.ally > 0)) continue // traitors are fair game too
            const d = dist(z, o)
            if (d < bd) {
              bd = d
              best = o
            }
          }
          z.target = best
        }
        if (!z.target) {
          // nothing in sight: shamble along the cloister
          followRing(z, zSpeed * 0.7, dt)
          unstick(z, dt)
          z.attacking = false
          z.y = floorAt(z.x, z.z)
          continue
        }
        const tg = z.target
        const d = navTo(z, tg.x, tg.z, zSpeed, dt, REACH * 0.9)
        unstick(z, dt)
        z.attacking = d <= REACH
        if (z.attacking) {
          if (tg === p) {
            // the shield soaks damage first
            let dmg = PLAYER_DPS * dt
            const soak = Math.min(S.shield, dmg)
            S.shield -= soak
            dmg -= soak
            S.hp -= dmg
            if (S.hurtT <= 0) {
              sfx.hurt() // you got hit (at most twice a second, not a constant buzz)
              S.hurtT = 0.5
            }
          } else {
            tg.hp -= CLAW_DPS * dt
            tg.flash = 0.15
            if (tg.ally > 0 && tg.hp <= 0) tg.ally = 0.001 // an ally that's clawed down collapses
          }
        }
        z.y = floorAt(z.x, z.z)
      }
      // keep zombies from stacking into one blob
      for (let a = 0; a < MAX_ZOMBIES; a++) {
        const za = S.zombies[a]
        if (!za.on || za.down) continue
        for (let b = a + 1; b < MAX_ZOMBIES; b++) {
          const zb = S.zombies[b]
          if (!zb.on || zb.down) continue
          const dx = zb.x - za.x
          const dz = zb.z - za.z
          const d = Math.hypot(dx, dz)
          if (d < 0.9 && d > 1e-4) {
            const push = (0.9 - d) / 2
            za.x -= (dx / d) * push
            za.z -= (dz / d) * push
            zb.x += (dx / d) * push
            zb.z += (dz / d) * push
          }
        }
      }
      const live = S.zombies.filter(hostile)
      // who's already on which zombie (students keep their target, so the gangs stay put)
      const claims = new Map()
      for (const s of S.students) {
        if (!s.on || s.down || !s.target) continue
        if (!hostile(s.target) || dist(s, s.target) > SIGHT_S * 1.3) s.target = null
        else claims.set(s.target, (claims.get(s.target) || 0) + 1)
      }

      // students: roam the building and hunt zombies on their own; spread out instead of bunching up
      for (const s of S.students) {
        if (!s.on) continue
        s.flash = Math.max(0, (s.flash || 0) - dt)
        if (s.down) {
          s.downT += dt
          if (s.downT > KO_TIME) spawnStudent(s, p, false) // back on their feet, somewhere in the halls
          continue
        }
        if (s.hp <= 0) {
          s.down = true
          s.downT = 0
          s.attacking = false
          s.moving = false
          continue
        }
        if (!s.target) {
          let bd = SIGHT_S
          for (const z of live) {
            if ((claims.get(z) || 0) >= (z.thief ? PER_THIEF : PER_ZOMBIE)) continue // enough on that one already
            const d = dist(s, z) * (z.thief ? 0.5 : 1) // a Labubu thief is a priority target
            if (d < bd) {
              bd = d
              s.target = z
            }
          }
          if (s.target) claims.set(s.target, (claims.get(s.target) || 0) + 1)
        }
        const best = s.target
        // giving way in a crowd: stand a moment (but still swing at anything in reach)
        if (s.yieldT > 0) {
          s.yieldT -= dt
          s.moving = false
          s.attacking = !!best && dist(s, best) <= REACH
          s.y = floorAt(s.x, s.z)
          continue
        }
        if (best) {
          // close in from the side (each student flanks a little differently)
          const dx = best.x - s.x
          const dz = best.z - s.z
          const l = Math.hypot(dx, dz) || 1
          const flank = Math.min(1, l / 4) * 0.9 * s.side
          const d = navTo(s, best.x - (dz / l) * flank, best.z + (dx / l) * flank, S_SPEED * s.pace, dt, REACH * 0.85)
          s.attacking = d <= REACH
          s.cool -= dt
          if (s.attacking && s.cool <= 0) {
            best.hp -= PUNCH
            best.flash = 0.2
            s.cool = 1
          }
        } else {
          // patrol: walk the cloister looking for Harvard
          s.attacking = false
          followRing(s, S_SPEED * 0.55 * s.pace, dt)
        }
        let near = 0
        for (const o of S.students) if (o !== s && o.on && !o.down && Math.abs(o.x - s.x) < 1.3 && Math.abs(o.z - s.z) < 1.3) near++
        unstick(s, dt, near >= 2)
        s.y = floorAt(s.x, s.z)
      }
      // students keep their distance from each other too
      for (let a = 0; a < MAX_STUDENTS; a++) {
        const sa = S.students[a]
        if (!sa.on || sa.down) continue
        for (let b = a + 1; b < MAX_STUDENTS; b++) {
          const sb = S.students[b]
          if (!sb.on || sb.down) continue
          const dx = sb.x - sa.x
          const dz = sb.z - sa.z
          const d = Math.hypot(dx, dz)
          if (d < SPACE_S && d > 1e-4) {
            // ease apart (not a shove), and never into a wall or a bench
            const push = (SPACE_S - d) * 0.25
            for (const [who, sgn] of [[sa, -1], [sb, 1]]) {
              _p.x = who.x + (dx / d) * push * sgn
              _p.z = who.z + (dz / d) * push * sgn
              collide(_p, 1)
              who.x = _p.x
              who.z = _p.z
            }
          }
        }
      }

      // Handsome Dan, companion: heel by your side, fight anything near you, use his abilities
      {
        const lvl = dan.level
        for (const k in dan.cool) dan.cool[k] = Math.max(0, dan.cool[k] - dt)
        if (dist(dan, p) > 25) Object.assign(dan, { x: p.x, z: p.z }) // got stuck somewhere: catch up
        // leashed: he only fights zombies near you, and drops a chase that drags him away from you
        if (dan.target && (!hostile(dan.target) || dist(dan.target, p) > DAN_LEASH + 1 || dist(dan, p) > DAN_LEASH)) dan.target = null
        if (!dan.target) {
          let bd = DAN_LEASH
          for (const z of live) {
            const d = dist(z, p)
            if (d < bd) {
              bd = d
              dan.target = z
            }
          }
        }
        let biting = false
        if (dan.target) {
          // Lv3 Bulldog Charge: a burst of speed into the target that knocks it flying
          if (lvl >= 3 && dan.cool.charge === 0 && dist(dan, dan.target) > 3) {
            dan.dash = 0.6
            dan.cool.charge = 6
          }
          const fast = dan.dash > 0 ? 3 : 1
          dan.dash = Math.max(0, dan.dash - dt)
          const d = navTo(dan, dan.target.x, dan.target.z, DAN_SPEED * fast, dt, 0.55)
          if (d <= 0.75) {
            biting = true
            dan.target.hp -= BITE_DPS * (1 + (lvl - 1) * 0.25) * dt
            dan.target.flash = 0.1
            if (fast > 1) {
              dan.target.hp -= 3
              dan.target.stun = 1.2
              dan.dash = 0
            }
          }
        } else {
          // heel: a step behind you and to the right
          camera.getWorldDirection(_fwd)
          navTo(dan, p.x - _fwd.x * 1.6 - _fwd.z * 0.9, p.z - _fwd.z * 1.6 + _fwd.x * 0.9, DAN_SPEED, dt, 0.3)
        }
        // a stuck companion just pops back to your side
        dan.stuckT = (dan.stuckT ?? 0) + dt
        if (dan.stuckT > 1.5) {
          if (dan.moving && dan.lx != null && Math.hypot(dan.x - dan.lx, dan.z - dan.lz) < 0.35 && dist(dan, p) > 2.5) Object.assign(dan, { x: p.x - _fwd.x * 1.2, z: p.z - _fwd.z * 1.2 })
          Object.assign(dan, { stuckT: 0, lx: dan.x, lz: dan.z })
        }
        // Lv2 Bark Stun: freezes zombies around him
        if (lvl >= 2 && dan.cool.bark === 0 && live.some((z) => dist(z, dan) < 5)) {
          for (const z of live) if (dist(z, dan) < 5) z.stun = Math.max(z.stun || 0, 2)
          dan.cool.bark = 8
          S.fx.push({ x: dan.x, z: dan.z, r: 5, life: 0.5, max: 0.5, color: '#4aa3ff' })
        }
        // Lv4 Boola Boola Howl: heals you and the squad
        if (lvl >= 4 && dan.cool.howl === 0 && S.hp > 0 && (S.hp < 70 || S.students.some((s) => s.on && !s.down && s.hp < 3))) {
          S.hp = Math.min(100, S.hp + 15)
          for (const s of S.students) if (s.on && !s.down) s.hp = 5
          dan.cool.howl = 15
          S.fx.push({ x: dan.x, z: dan.z, r: 7, life: 0.8, max: 0.8, color: '#7dff9a' })
          banner('🎶 Boola Boola! Handsome Dan’s howl patches everyone up.', 2000)
        }
        // Lv5 Golden Dan: everything near him burns
        if (lvl >= 5) for (const z of live) if (dist(z, dan) < 3) z.hp -= 1.5 * dt
        Object.assign(DAN, { x: dan.x, z: dan.z, yaw: dan.yaw, moving: dan.moving, biting })
      }

      // business cards: fly straight, slice through up to 3 zombies
      S.cards = S.cards.filter((c) => {
        for (let sub = 0; sub < 2; sub++) {
          c.x += (c.vx * dt) / 2
          c.z += (c.vz * dt) / 2
          for (const z of S.zombies) {
            if (!hostile(z) || c.hits.has(z) || Math.hypot(z.x - c.x, z.z - c.z) > 0.45) continue
            c.hits.add(z)
            z.hp -= SHURIKEN.damage * (S.weapon?.mult || 1)
            z.flash = 0.2
            sfx.hit(false)
            if (c.hits.size >= SHURIKEN.pierce) return false
          }
        }
        return (c.left -= dt) > 0 && !wallAt(c.x, c.z, c.y) // stops at a wall, sails over benches
      })
      // coffee thermoses: arc through the air, burst on landing
      S.thermoses = S.thermoses.filter((g) => {
        g.vy -= 12 * dt
        g.x += g.vx * dt
        g.y += g.vy * dt
        g.z += g.vz * dt
        g.spin += dt * 12
        const floor = floorAt(g.x, g.z)
        const touching = S.zombies.some((z) => hostile(z) && Math.hypot(z.x - g.x, z.z - g.z) < 0.5 && g.y < floor + 1.8)
        if (g.y > floor + 0.08 && !touching && !wallAt(g.x, g.z, g.y, 0.06)) return true // bursts on the floor, a zombie, or a wall
        for (const z of S.zombies) {
          if (!hostile(z)) continue
          const d = Math.hypot(z.x - g.x, z.z - g.z)
          if (d > THERMOS.radius) continue
          z.hp -= THERMOS.damage * (1 - (d / THERMOS.radius) * 0.5)
          z.burn = THERMOS.burnTime
          z.flash = 0.3
        }
        S.fx.push({ x: g.x, z: g.z, r: THERMOS.radius, life: 0.7, max: 0.7, color: '#ff8a2e' })
        sfx.boom()
        return false
      })

      // tension: groans from the nearest zombie, a heartbeat when you're hurt
      S.groanT -= dt
      if (S.groanT <= 0) {
        S.groanT = 2 + Math.random() * 4
        const near = Math.min(99, ...live.map((z) => dist(z, p)))
        sfx.groan(Math.max(0, 1 - near / 28))
      }
      if (S.hp < 40) {
        S.beatT -= dt
        if (S.beatT <= 0) {
          S.beatT = 0.45 + S.hp / 60
          sfx.heartbeat(1 - S.hp / 60)
        }
      }

      // the Labubu clock: if Harvard still has it when time runs out, the game is over
      let lost = false
      if (S.labubuT > 0) {
        S.labubuT = Math.max(0, S.labubuT - dt)
        if (S.labubuT === 0) {
          lost = true
          sfx.stinger(true)
        }
      }

      // your health
      S.hp = Math.max(0, S.hp)
      pushHud()
      if (S.hp <= 0 || lost) chat.set({ over: { wave: S.wave, kills: S.kills, labubu: lost }, zombie: null })
    }

    // ---------- draw
    const zm = zMeshes.current
    const sm = sMeshes.current
    S.zombies.forEach((z, i) => poseAgent(zm, ZOMBIE, i, z, t, 'z'))
    S.students.forEach((s, i) => poseAgent(sm, STUDENT, i, s, t, 's'))
    for (const mesh of [...zm, ...sm]) mesh.instanceMatrix.needsUpdate = true

    // the Labubu in the thief's arms, and a red beacon over the thief so you can find it
    const thief = S.zombies.find((z) => z.on && !z.down && z.thief)
    thiefMark.current.visible = !!thief
    thiefLabubu.current.visible = !!thief?.thief.carrying
    if (thief) {
      thiefMark.current.position.set(thief.x, thief.y + 2.25 + Math.sin(t * 6) * 0.08, thief.z)
      thiefMark.current.scale.setScalar(0.5 + Math.sin(t * 8) * 0.1)
      thiefLabubu.current.position.set(thief.x + Math.sin(thief.yaw) * 0.3, thief.y + 1.05, thief.z + Math.cos(thief.yaw) * 0.3)
      thiefLabubu.current.rotation.y = thief.yaw
    }

    // spell / bark / howl rings on the floor
    S.fx = S.fx.filter((f) => (f.life -= dt) > 0)
    rings.current.forEach((mesh, k) => {
      const f = S.fx[k]
      mesh.visible = !!f
      if (!f) return
      const k2 = 1 - f.life / f.max
      mesh.position.set(f.x, floorAt(f.x, f.z) + 0.05, f.z)
      mesh.scale.setScalar(Math.max(0.01, f.r * k2))
      mesh.material.color.set(f.color)
      mesh.material.opacity = f.life / f.max
    })

    // study notes bob and glow
    notes.current.forEach((n, k) => {
      if (!n) return
      n.position.y = NOTES[k].p[1] + Math.sin(t * 2 + k) * 0.06
      n.scale.set(0.34 * (1 + Math.sin(t * 3 + k) * 0.05), 0.42 * (1 + Math.sin(t * 3 + k) * 0.05), 1)
    })

    // flying cards + thermoses, and blue halos over zombies you've taken over
    cardMesh.current.count = S.cards.length
    S.cards.forEach((c, k) => {
      _o.position.set(c.x, c.y, c.z)
      _o.rotation.set(0, t * 25 + k, 0)
      _o.scale.set(1, 1, 1)
      _o.updateMatrix()
      cardMesh.current.setMatrixAt(k, _o.matrix)
    })
    cardMesh.current.instanceMatrix.needsUpdate = true
    thermosMesh.current.count = S.thermoses.length
    S.thermoses.forEach((g, k) => {
      _o.position.set(g.x, g.y, g.z)
      _o.rotation.set(g.spin, 0, g.spin * 0.6)
      _o.updateMatrix()
      thermosMesh.current.setMatrixAt(k, _o.matrix)
    })
    thermosMesh.current.instanceMatrix.needsUpdate = true
    const allies = S.zombies.filter((z) => z.on && !z.down && z.ally > 0)
    allyMarks.current.forEach((m, k) => {
      const z = allies[k]
      m.visible = !!z
      if (z) m.position.set(z.x, z.y + 2.2, z.z)
    })

    // aiming: zombies first (up to takeover range), then the vending machine, then study notes
    if (frame.current++ % 2 === 0) {
      let hitZ = null
      let hitN = null
      let hitV = false
      let hitC = false
      S.aim = null
      if (running && !st.talkingTo) {
        ray.setFromCamera(CENTER, camera)
        ray.far = TAKEOVER.range
        const hits = ray.intersectObjects(
          zm.filter((_, j) => ZOMBIE[j].hit),
          false,
        )
        const h = hits.find((x) => hostile(S.zombies[x.instanceId] || {}))
        if (h) S.aim = { i: h.instanceId, d: h.distance }
        const reach = Math.max(MELEE[S.melee].range, S.weapon?.range || 0, BONK_RANGE) + 0.3
        if (h && h.distance <= reach) hitZ = h.instanceId
        else if (!h) {
          ray.far = NOTE_RANGE
          hitV = ray.intersectObject(vending.current, true).length > 0
          hitC = !hitV && ray.intersectObject(coffee.current, true).length > 0
          if (!hitV && !hitC) {
            const nh = ray.intersectObjects(notes.current.filter(Boolean), false)[0]
            if (nh) hitN = nh.object.userData.id
          }
        }
      }
      if (hitZ !== st.zombie) chat.set({ zombie: hitZ })
      if (hitN !== st.note) chat.set({ note: hitN })
      if (hitV !== !!st.vending) chat.set({ vending: hitV })
      if (hitC !== !!st.coffee) chat.set({ coffee: hitC })
    }
  })

  return (
    <>
      {ZOMBIE.map((pt, j) => (
        <instancedMesh key={`z${j}`} ref={(el) => (zMeshes.current[j] = el)} args={[pt.g, pt.m, MAX_ZOMBIES]} frustumCulled={false} />
      ))}
      {STUDENT.map((pt, j) => (
        <instancedMesh key={`s${j}`} ref={(el) => (sMeshes.current[j] = el)} args={[pt.g, pt.m, MAX_STUDENTS]} frustumCulled={false} />
      ))}
      {NOTES.map((n, k) => (
        <sprite key={n.id} ref={(el) => (notes.current[k] = el)} position={n.p} userData={{ id: n.id }}>
          <spriteMaterial map={tex.paper} toneMapped={false} />
        </sprite>
      ))}
      {Array.from({ length: 6 }, (_, k) => (
        <mesh key={k} ref={(el) => (rings.current[k] = el)} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.85, 1, 48]} />
          <meshBasicMaterial transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <sprite ref={thiefMark} visible={false}>
        <spriteMaterial map={tex.red} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <group ref={thiefLabubu} visible={false}>
        <Labubu height={0.32} expression="surprised" />
      </group>
      <instancedMesh ref={cardMesh} args={[CARD_GEO, CARD_MAT, 40]} frustumCulled={false} />
      <instancedMesh ref={thermosMesh} args={[THERMOS_GEO, THERMOS_MAT, 8]} frustumCulled={false} />
      {Array.from({ length: 6 }, (_, k) => (
        <sprite key={k} ref={(el) => (allyMarks.current[k] = el)} visible={false} scale={0.45}>
          <spriteMaterial map={tex.blue} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
      <VendingMachine innerRef={vending} />
      <CoffeeTable innerRef={coffee} />
    </>
  )
}
