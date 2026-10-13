import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, Noise, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import World from './World.jsx'
import Player from './Player.jsx'
import Hands from './Hands.jsx'
import Minimap from './Minimap.jsx'
import TouchControls from './TouchControls.jsx'
import ChatWindow from './ChatWindow.jsx'
import WeaponWheel from './WeaponWheel.jsx'
import { CHAT_PROFESSORS, chat, useChat } from './chat.js'
import { COFFEE, DAN_LEVELS, RANGED, buy, canShop, drinkCoffee, freeSeats, hire, meleeAttack, resetRivals, say, sicEm, startNextWave, useRanged } from './Rivals.jsx'
import { ADMIT, ITEMS, MELEE, SHURIKEN } from './weapons.js'
import * as sfx from './sfx.js'
import { NOTES } from './notes.js'
import { EYE, SPAWN } from './layout.js'

// Crimson Tide of the Dead: Harvard zombies vs. Yale in Evans Hall at night.
// ?classic in the URL turns off shadows + post-processing (for slow computers).
const HQ = !new URLSearchParams(location.search).has('classic')
// phones and tablets get a lighter look: no shadows or ambient occlusion, a lower pixel ratio, and only
// the cheap effects (bloom keeps the glowing eyes; the grade keeps the mood)
const PHONE = matchMedia('(pointer: coarse)').matches

export default function App() {
  const [locked, setLocked] = useState(false)
  const [where, setWhere] = useState('')
  const [showMap, setShowMap] = useState(true)
  const lockRef = useRef()
  const mapRef = useRef()
  const onLock = useCallback((v) => setLocked(v), [])
  const onWhere = useCallback((w) => setWhere(w), [])
  // phones have no pointer lock, so they get a joystick + drag-to-look instead
  const [isTouch] = useState(() => matchMedia('(pointer: coarse)').matches) // phones + tablets; touchscreen laptops still get mouse mode
  const [touchOn, setTouchOn] = useState(false)
  const touchRef = useRef({ active: false, move: [0, 0], look: [0, 0] })
  const setTouch = (on) => {
    if (on) setShowMap(false) // phones: the map is a tap away, not in your face
    touchRef.current.active = on
    touchRef.current.move = [0, 0]
    setTouchOn(on)
  }
  // overlays (chat, notes, shop, game over) take the mouse; closing one hands control back
  const release = () => {
    if (document.pointerLockElement) document.exitPointerLock()
    touchRef.current.active = false
    touchRef.current.move = [0, 0]
  }
  const resume = (relock = true) => {
    if (touchOn) touchRef.current.active = true
    else if (relock) lockRef.current?.() // the closing click counts as a gesture, so we can re-grab the mouse
  }
  const playing = locked || touchOn
  // phone buttons act on touch-down: iOS drops "click"s while another finger (the joystick thumb) is down
  const tap = (fn) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    sfx.start()
    fn()
  }
  // phone layout (styles.css: .touchmode): the status panel moves up out of the thumbs' way
  useEffect(() => {
    document.body.classList.toggle('touchmode', touchOn)
  }, [touchOn])
  const typing = (e) => e.target.closest?.('input, textarea')
  useEffect(() => {
    const k = (e) => e.code === 'KeyM' && !typing(e) && setShowMap((v) => !v)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  // what's under the crosshair
  const aiming = useChat((s) => s.aiming) // a professor
  const zombie = useChat((s) => s.zombie)
  const note = useChat((s) => s.note)
  const vending = useChat((s) => s.vending)
  const coffee = useChat((s) => s.coffee)
  const admissions = useChat((s) => s.admissions)
  const talkingTo = useChat((s) => s.talkingTo)
  // the fight
  const wave = useChat((s) => s.wave)
  const kills = useChat((s) => s.kills)
  const hp = useChat((s) => s.hp) ?? 100
  const over = useChat((s) => s.over)
  const banner = useChat((s) => s.banner)
  const shield = useChat((s) => s.shield) || 0
  const spells = useChat((s) => s.spells) || 0
  const powerWeapon = useChat((s) => s.powerWeapon)
  const slowed = useChat((s) => s.slowed) || 0
  const danLevel = useChat((s) => s.danLevel) || 1
  const labubuIn = useChat((s) => s.labubuIn) || 0
  const labubuStolen = useChat((s) => s.labubuStolen)
  const labubuState = useChat((s) => s.labubuState) || 'home'
  const classmates = useChat((s) => s.classmates) ?? 0
  const boss = useChat((s) => s.boss)
  const coffeeIn = useChat((s) => s.coffeeIn) || 0
  // the arsenal + the Endowment Office (shop)
  const endowment = useChat((s) => s.endowment) ?? 0
  const inv = useChat((s) => s.inv) || {}
  const melee = useChat((s) => s.melee) || 'wsj'
  const ranged = useChat((s) => s.ranged) || 'thermos'
  const intermission = useChat((s) => s.intermission) || 0
  const crash = useChat((s) => s.crash) || 0
  const [muted, setMutedState] = useState(sfx.isMuted())

  // study notes (answers to the professors' questions) hidden around the building
  const [reading, setReading] = useState(null)
  const openNote = useCallback((id) => {
    setReading(NOTES.find((n) => n.id === id))
    release()
  }, [])
  const closeNote = () => {
    setReading(null)
    resume()
  }
  const [shopOpen, setShopOpen] = useState(false)
  const openShop = useCallback(() => {
    if (!canShop()) return say('🏛️ The Endowment Office only opens between waves. Survive this one!', 2200)
    setShopOpen(true)
    release()
  }, [])
  const closeShop = (nextWave) => {
    setShopOpen(false)
    if (nextWave) startNextWave()
    resume()
  }
  // Admissions (by the coffee table): recruit classmates, any time
  const [admitOpen, setAdmitOpen] = useState(false)
  const openAdmit = useCallback(() => {
    setAdmitOpen(true)
    release()
  }, [])
  const closeAdmit = () => {
    setAdmitOpen(false)
    resume()
  }
  const openChat = useCallback((id) => {
    chat.set({ talkingTo: id, aiming: null })
    release() // free the mouse for typing
  }, [])
  const closeChat = (relock) => {
    chat.set({ talkingTo: null })
    resume(relock)
  }
  useEffect(() => {
    if (over) release()
  }, [over])
  const fightAgain = () => {
    resetRivals()
    resume()
  }

  const hud = playing && !talkingTo && !over && !reading && !shopOpen && !admitOpen
  useEffect(() => chat.set({ simRunning: hud }), [hud]) // the fight freezes while paused, chatting, reading, or shopping
  useEffect(() => {
    if (!hud) chat.set({ wheelOpen: false })
  }, [hud])

  // Controls: Space (or left click) melee, L (or right click) the long-range weapon you've picked, hold Tab
  // for the weapon wheel, Q sic 'em, B shop, E (or click) talk / read / shop / grab coffee.
  useEffect(() => {
    const interact = (st) => {
      if (st.coffee) return drinkCoffee(), true
      if (st.admissions) return openAdmit(), true
      if (st.vending) return openShop(), true
      if (st.note != null) return openNote(st.note), true
      if (st.aiming) return openChat(st.aiming), true
      return false
    }
    const onInput = (e) => {
      const st = chat.get()
      if (st.over || !document.pointerLockElement) return
      if (e.type === 'keydown' && typing(e)) return
      sfx.start() // audio can only start from a user gesture
      if (e.type === 'mousedown') {
        if (e.button === 2) return useRanged()
        if (e.button !== 0) return
        if (st.zombie == null && interact(st)) return // zombies first: no stopping to chat mid-fight
        return meleeAttack()
      }
      if (e.code === 'KeyE') return void interact(st)
      if (e.code === 'Tab') {
        e.preventDefault()
        if (!e.repeat) chat.set({ wheelOpen: true }) // WeaponWheel closes it on Tab release
        return
      }
      if (st.wheelOpen) return
      const keys = { Space: meleeAttack, KeyL: useRanged, KeyQ: sicEm, KeyB: openShop }
      keys[e.code]?.()
    }
    const noMenu = (e) => document.pointerLockElement && e.preventDefault() // right click throws, not menus
    window.addEventListener('mousedown', onInput)
    window.addEventListener('keydown', onInput)
    window.addEventListener('contextmenu', noMenu)
    return () => {
      window.removeEventListener('mousedown', onInput)
      window.removeEventListener('keydown', onInput)
      window.removeEventListener('contextmenu', noMenu)
    }
  }, [openChat, openNote, openShop, openAdmit])

  // the one thing under the crosshair you can interact with (zombies win; you swing at those)
  const target = zombie != null ? null : coffee ? 'coffee' : admissions ? 'admissions' : vending ? 'vending' : note != null ? 'note' : aiming ? 'prof' : null
  const hint = {
    coffee: coffeeIn > 0 ? [`☕ The urn is refilling: ${coffeeIn}s`, null] : hp >= 100 ? ['☕ Coffee & snacks (you’re at full health)', null] : [`to grab coffee ☕ (+${COFFEE.heal} health)`, drinkCoffee],
    vending: ['to open the Endowment Office 🏛️', openShop],
    admissions: ['to visit Admissions 🎓 (recruit classmates)', openAdmit],
    note: ['to read the study note 📜', () => openNote(note)],
    prof: [`to talk to ${CHAT_PROFESSORS[aiming]?.name}`, () => openChat(aiming)],
  }[target]

  return (
    <>
      <Canvas camera={{ fov: 72, near: 0.05, far: 800, position: [SPAWN.x, EYE, SPAWN.z] }} dpr={PHONE ? [1, 1.5] : [1, 1.75]} shadows={HQ && !PHONE}>
        <World />
        <Player lockRef={lockRef} mapRef={mapRef} touchRef={touchRef} onLock={onLock} onWhere={onWhere} />
        <Hands />
        {/* ambient occlusion grounds everything, lights and glowing eyes bloom, then a drained, grainy, filmic
            grade with a tight vignette: dread, not cartoon */}
        {HQ && PHONE && (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur luminanceThreshold={1.4} luminanceSmoothing={0.2} intensity={1.1} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <HueSaturation saturation={-0.42} />
            <BrightnessContrast contrast={0.14} brightness={-0.03} />
            <Vignette offset={0.18} darkness={0.88} />
          </EffectComposer>
        )}
        {HQ && !PHONE && (
          <EffectComposer multisampling={0}>
            <N8AO halfRes quality="medium" aoRadius={1.4} distanceFalloff={0.6} intensity={3.2} />
            <Bloom mipmapBlur luminanceThreshold={1.4} luminanceSmoothing={0.2} intensity={1.1} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            <HueSaturation saturation={-0.42} />
            <BrightnessContrast contrast={0.14} brightness={-0.03} />
            <SMAA />
            <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={0.14} />
            <Vignette offset={0.18} darkness={0.88} />
          </EffectComposer>
        )}
      </Canvas>

      <div className="where">
        <span className="dot" />
        <span className="wtext">{where}</span>
      </div>
      <div className={showMap ? 'mapwrap' : 'mapwrap hidden'}>
        <Minimap drawRef={mapRef} />
      </div>
      <button className="maptoggle" onClick={() => setShowMap((s) => !s)}>
        {showMap ? 'hide map' : 'map'}
      </button>

      <div className="rivalshud" aria-label="Fight status">
        <div className="row">
          <span>🧟 Wave <b>{wave || 1}</b></span>
          <span>💀 <b>{kills || 0}</b> down</span>
          <span title="Classmates fighting for you (recruit more at Admissions, by the coffee table)">🎓 <b>{classmates}</b> classmates</span>
          <span className="hpbar" role="meter" aria-label="Health" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${hp}%` }} />
            {shield > 0 && <span className="shield" style={{ width: `${Math.min(100, shield)}%` }} />}
          </span>
        </div>
        <div className="row small">
          <span title={DAN_LEVELS.slice(0, danLevel).map((l) => l.name).join(', ')}>
            🐶 Dan Lv <b>{danLevel}</b> {DAN_LEVELS.slice(0, danLevel).map((l) => l.icon).join('')}
          </span>
          {spells > 0 && <span>✨ ×{spells} spells</span>}
          {powerWeapon && <span>🗡️ {powerWeapon.name} {powerWeapon.left}s</span>}
          {shield > 0 && <span>🛡️ {shield}</span>}
          {slowed > 0 && <span>📚 slowed {slowed}s</span>}
          {labubuStolen && <span className="alert">{labubuState === 'player' ? '🧸 You have the Labubu!' : labubuState === 'dropped' ? '🧸 Labubu dropped!' : '😱 Labubu stolen!'}</span>}
        </div>
        <div className="row small loadout">
          <span className="cash">💰 ${endowment.toLocaleString()}</span>
          <span className="slot on">
            {MELEE[melee].icon} {MELEE[melee].name} <kbd>Space</kbd>
          </span>
          <span className={RANGED[ranged]?.have() ? 'slot on' : 'slot'}>
            {RANGED[ranged]?.icon} {RANGED[ranged]?.name}
            {RANGED[ranged]?.count() != null && ` ×${RANGED[ranged].count()}`} <kbd>L</kbd>
          </span>
          <span className="slot">
            🎯 wheel <kbd>Tab</kbd>
          </span>
          <button className="mute" onClick={() => (sfx.setMuted(!muted), setMutedState(!muted))} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        {intermission > 0 && (
          <div className="row small intermission">
            <span>
              ⏳ Next wave in <b>{intermission}s</b>
            </span>
            <button className="spell" onClick={openShop}>
              🏛️ Endowment Office <kbd>B</kbd>
            </button>
          </div>
        )}
      </div>
      {crash > 0 && (
        <div className="crashticker" role="status">
          📉 MARKET CRASH · HRVD ▼ {(12 - crash) * 7 + 9}% · {crash}s
        </div>
      )}
      {boss && !over && playing && (
        <div className="bossbar" role="meter" aria-label={`${boss.name} health`} aria-valuenow={boss.pct} aria-valuemin={0} aria-valuemax={100}>
          <small>👑 {boss.name}</small>
          <span>
            <span style={{ width: `${boss.pct}%` }} />
          </span>
        </div>
      )}
      {labubuIn > 0 && !over && (
        <div className={labubuIn <= 10 ? 'labubuclock final' : 'labubuclock'} role="timer" aria-label={`${labubuIn} seconds to get the Labubu back`}>
          <small>
            {labubuState === 'player'
              ? 'Get it back to Prof. Zaman (room 2200)'
              : labubuState === 'dropped'
                ? 'The Labubu is on the floor: grab it!'
                : 'Harvard escapes with the Labubu in'}
          </small>
          <b>
            {Math.floor(labubuIn / 60)}:{String(labubuIn % 60).padStart(2, '0')}
          </b>
        </div>
      )}
      {hp < 100 && <div className="hurt" style={{ opacity: (1 - hp / 100) * 0.6 }} />}
      {banner && (
        <div className="rivalsbanner" role="status">
          {banner}
        </div>
      )}

      {hud && <div className={zombie != null ? 'crosshair on danger' : target ? 'crosshair on' : 'crosshair'} />}
      {hud && hint &&
        (touchOn ? (
          <button className="talkhint tap" onPointerDown={hint[1] ? tap(hint[1]) : undefined} disabled={!hint[1]}>
            {hint[0]}
          </button>
        ) : (
          <div className="talkhint">
            {hint[1] && <b>Click </b>}
            {hint[0]}
          </div>
        ))}
      {hud && touchOn && (
        <>
          {/* phones: one slim status strip across the top */}
          <div className="mhud" aria-label="Fight status">
            <button className="mbtn" onPointerDown={tap(() => setTouch(false))} aria-label="Pause">
              ⏸
            </button>
            <div className="mstats">
              <span>🧟 <b>{wave || 1}</b></span>
              <span>💀 <b>{kills || 0}</b></span>
              <span>🎓 <b>{classmates}</b></span>
              <span className="hpbar" role="meter" aria-label="Health" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${hp}%` }} />
                {shield > 0 && <span className="shield" style={{ width: `${Math.min(100, shield)}%` }} />}
              </span>
              <span className="cash">${endowment.toLocaleString()}</span>
              <span>🐶 <b>{danLevel}</b></span>
            </div>
            <button className="mbtn" onPointerDown={tap(() => setShowMap((v) => !v))} aria-label={showMap ? 'Hide map' : 'Show map'}>
              🗺️
            </button>
            <button className="mbtn" onPointerDown={tap(() => (sfx.setMuted(!muted), setMutedState(!muted)))} aria-label={muted ? 'Unmute sound' : 'Mute sound'}>
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
          <div className="mchips">
            {labubuStolen && <span className="alert">{labubuState === 'player' ? '🧸 You have the Labubu!' : labubuState === 'dropped' ? '🧸 Labubu dropped!' : '😱 Labubu stolen!'}</span>}
            {powerWeapon && <span>🗡️ {powerWeapon.name} {powerWeapon.left}s</span>}
            {slowed > 0 && <span>📚 slowed {slowed}s</span>}
            {intermission > 0 && (
              <button onPointerDown={tap(openShop)}>
                🏛️ Shop · next wave {intermission}s
              </button>
            )}
          </div>
          {/* right thumb: a big attack button, throw beside it, wheel + Dan above */}
          <div className="mpad">
            <button className="attack" onPointerDown={tap(meleeAttack)} aria-label={`Swing the ${MELEE[melee].name}`}>
              <span>{MELEE[melee].icon}</span>
              <small>HIT</small>
            </button>
            <button className={RANGED[ranged]?.have() ? 'throw' : 'throw empty'} onPointerDown={tap(useRanged)} aria-label={`Use ${RANGED[ranged]?.name}`}>
              <span>{RANGED[ranged]?.icon}</span>
              <small>{RANGED[ranged]?.count() != null ? `×${RANGED[ranged].count()}` : 'THROW'}</small>
            </button>
            <button className="wheelbtn" onPointerDown={tap(() => chat.set({ wheelOpen: true }))} aria-label="Weapon wheel">
              🎯
            </button>
            <button className="danbtn" onPointerDown={tap(sicEm)} aria-label="Sic 'em, Dan">
              🐶
            </button>
          </div>
        </>
      )}
      {touchOn && !talkingTo && <TouchControls touchRef={touchRef} />}
      {talkingTo && <ChatWindow id={talkingTo} onClose={closeChat} />}
      <WeaponWheel />

      {shopOpen && (
        <div className="overlay notecard-wrap">
          <div className="card shop" role="dialog" aria-label="Endowment Office">
            <div className="kicker">🏛️ Endowment Office · between waves</div>
            <h2>💰 ${endowment.toLocaleString()}</h2>
            <p className="sub">Kills earn Endowment. Spend it wisely: the next wave won't wait forever.</p>
            <div className="shopgrid">
              {[
                ...Object.entries(MELEE)
                  .filter(([id]) => id !== 'wsj')
                  .map(([id, w]) => ({ id, ...w, kind: 'Melee', owned: !!inv[id] })),
                { id: 'cards', ...SHURIKEN, kind: `Long range · box of ${SHURIKEN.pack}`, count: inv.cards || 0 },
                ...Object.entries(ITEMS).map(([id, it]) => ({ id, ...it, kind: 'Long range · pick it on the wheel', count: inv[id] || 0 })),
              ].map((it) => (
                <div key={it.id} className={it.owned ? 'item owned' : 'item'}>
                  <div className="icon">{it.icon}</div>
                  <div>
                    <b>{it.name}</b>
                    <small>
                      {it.kind}
                      {it.count ? ` · you have ${it.count}` : ''}
                    </small>
                    <p>{it.desc}</p>
                  </div>
                  <button className="go" disabled={it.owned || endowment < it.price} onClick={() => buy(it.id)} aria-label={`Buy ${it.name} for $${it.price}`}>
                    {it.owned ? 'Owned' : `$${it.price.toLocaleString()}`}
                  </button>
                </div>
              ))}
            </div>
            <div className="shopfoot">
              <button className="go alt" onClick={() => closeShop(false)}>
                Back to the hall
              </button>
              <button className="go" onClick={() => closeShop(true)} autoFocus>
                Start the next wave
              </button>
            </div>
          </div>
        </div>
      )}

      {admitOpen && (
        <div className="overlay notecard-wrap">
          <div className="card shop" role="dialog" aria-label="Admissions">
            <div className="kicker">🎓 Yale Admissions · open all night</div>
            <h2>💰 ${endowment.toLocaleString()}</h2>
            <p className="sub">
              You have <b>{classmates}</b> classmate{classmates === 1 ? '' : 's'} fighting for you. Fallen classmates are gone for good, so recruit
              replacements here. New recruits report in at this desk.
            </p>
            <div className="shopgrid">
              {[
                { n: 1, icon: '🧑‍🎓', name: 'Recruit a classmate', desc: 'One more Yale student in a Halloween costume, ready to hunt Harvard zombies.', price: ADMIT.one },
                { n: 5, icon: '🎓', name: 'Recruit a study group', desc: 'Five classmates at once, at a group discount.', price: ADMIT.five },
              ].map((it) => (
                <div key={it.n} className="item">
                  <div className="icon">{it.icon}</div>
                  <div>
                    <b>{it.name}</b>
                    <small>{it.n === 1 ? 'one classmate' : `${it.n} classmates`}</small>
                    <p>{it.desc}</p>
                  </div>
                  <button className="go" disabled={endowment < it.price || freeSeats() < it.n} onClick={() => hire(it.n)} aria-label={`${it.name} for $${it.price}`}>
                    {freeSeats() < it.n ? 'Class is full' : `$${it.price.toLocaleString()}`}
                  </button>
                </div>
              ))}
            </div>
            <div className="shopfoot">
              <button className="go" onClick={closeAdmit} autoFocus>
                Back to the fight
              </button>
            </div>
          </div>
        </div>
      )}

      {reading && (
        <div className="overlay notecard-wrap" onClick={closeNote}>
          <div className="notecard" role="dialog" aria-label={`Study note: ${reading.place}`} onClick={(e) => e.stopPropagation()}>
            <div className="kicker">📜 Study note · {reading.place}</div>
            <p>{reading.text}</p>
            <div className="from">{reading.from}</div>
            <button className="go" onClick={closeNote} autoFocus>
              Got it
            </button>
          </div>
        </div>
      )}

      {over && (
        <div className="overlay boom">
          <div className="card" role="alertdialog" aria-label="Game over">
            <div className="kicker">Game over</div>
            <h1>{over.labubu ? '😱 Harvard escaped with the Labubu' : '🧟 Harvard took Evans Hall'}</h1>
            <p className="sub">
              {over.labubu
                ? 'The clock ran out and the Labubu is headed to Cambridge. Prof. Zaman will never be the same.'
                : 'The zombies got you. Your students and Handsome Dan fought bravely.'}
            </p>
            <div className="final">
              <div>
                <b>{over.wave}</b>
                <span>wave</span>
              </div>
              <div>
                <b>{over.kills}</b>
                <span>zombies down</span>
              </div>
            </div>
            <button className="go" onClick={fightAgain} autoFocus>
              Fight again
            </button>
          </div>
        </div>
      )}

      {!playing && !talkingTo && !over && !reading && !shopOpen && (
        <div
          className="overlay"
          onClick={() => {
            sfx.start()
            if (isTouch) setTouch(true)
            else lockRef.current?.()
          }}
        >
          <div className="card">
            <div className="kicker">Yale SOM · Evans Hall · Halloween night</div>
            <h1 className="title">Crimson Tide of the Dead</h1>
            <p className="rules">
              🧟 Harvard zombies are loose in Evans Hall, in growing waves. Fight with business school gear: kills earn <b>Endowment</b> to spend at the
              Endowment Office between waves, and Handsome Dan fights at your side. ⚡ Answer the professors' questions for <b>power-ups</b> (study notes with the
              answers are hidden around the building). ☕ Hurt? Grab coffee at the <b>snack table</b> in the south cloister (☕ on the map); 🎓 <b>Admissions</b> is right next to it. Fallen classmates are gone for good, so recruit more there. 👑 Every 4th wave brings a <b>boss</b>. 😱 Don't let them steal the{' '}
              <b>Labubu</b> off Prof. Zaman in room 2200! Every wave sends thieves after it. If one grabs it, drop the thief, pick up the Labubu, and bring it back to him within 90 seconds or the game is over.
            </p>
            <button className="go">{isTouch ? 'Tap to walk in' : 'Click to walk in'}</button>
            {!isTouch && (
              <button
                className="go alt"
                onClick={(e) => {
                  e.stopPropagation()
                  sfx.start()
                  setTouch(true)
                }}
              >
                Use on-screen joystick
              </button>
            )}
            {isTouch ? (
              <div className="keys">
                <span><b>Left thumb</b> joystick to walk (push all the way to hurry)</span>
                <span><b>Drag</b> anywhere else to look around</span>
                <span><b>Right thumb</b> big button hits, the one beside it throws; 🎯 picks weapons, 🐶 sends Dan</span>
                <span className="rotatetip">📱 Turn your phone sideways for the best view</span>
              </div>
            ) : (
              <div className="keys">
                <span><b>W A S D</b> walk</span>
                <span><b>← → ↑ ↓</b> look (mouse too)</span>
                <span><b>Shift</b> sprint</span>
                <span><b>C</b> crouch</span>
                <span><b>Space</b> melee</span>
                <span><b>L / right click</b> long range</span>
                <span><b>Hold Tab</b> weapon wheel</span>
                <span><b>Q</b> sic 'em, Dan</span>
                <span><b>E</b> talk / read / coffee</span>
                <span><b>B</b> shop</span>
                <span><b>M</b> map</span>
                <span><b>Esc</b> pause</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
