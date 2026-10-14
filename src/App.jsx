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
import { COFFEE, DAN_LEVELS, FINAL_WAVE, MESSAGES, buySpell, RANGED, buy, canShop, drinkCoffee, freeSeats, hire, hireHero, meleeAttack, nextTraining, PUZZLE, solvePuzzle, train, unlockBlaster, resetRivals, say, sicEm, startNextWave, useRanged } from './Rivals.jsx'
import { ADMIT, HEROES, ITEMS, MELEE, POSTER_Y, SHURIKEN, SPELLS, TRAINING } from './weapons.js'
import TradeGame from './TradeGame.jsx'
import { POSTER_TILES } from './textures.js'
import * as sfx from './sfx.js'
import { NOTES } from './notes.js'
import { checkAnswer, makePuzzle } from './puzzles.js'
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
  const puzzleAim = useChat((s) => s.puzzleAim)
  const posterAim = useChat((s) => s.posterAim)
  const termAim = useChat((s) => s.termAim)
  const bookAim = useChat((s) => s.bookAim)
  const tuition = useChat((s) => s.tuition)
  const compound = useChat((s) => s.compound) || 0
  const talkingTo = useChat((s) => s.talkingTo)
  // the fight
  const wave = useChat((s) => s.wave)
  const kills = useChat((s) => s.kills)
  const hp = useChat((s) => s.hp) ?? 100
  const over = useChat((s) => s.over)
  const msgSeq = useChat((s) => s.msgSeq)
  // game messages: a small feed in the corner (not a big banner in the middle of the screen). Each message
  // slides in, a few stack up, and each fades after a few seconds.
  const [toasts, setToasts] = useState([])
  useEffect(() => {
    // drain everything queued since last time (two messages in the same instant both get shown)
    const fresh = MESSAGES.splice(0).map((text) => ({ id: Math.random(), text, ms: Math.min(4000, 1800 + text.length * 20) })) // long enough to read, then gone
    if (!fresh.length) return
    setToasts((ts) => [...ts, ...fresh].slice(-3))
    for (const t of fresh) setTimeout(() => setToasts((ts) => ts.filter((q) => q.id !== t.id)), t.ms)
  }, [msgSeq])
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
  const training = useChat((s) => s.train) || {}
  const heroes = useChat((s) => s.heroes) || {}
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
  // the Case Competition puzzle: a fresh case each time you open it (and after a wrong answer)
  const [pz, setPz] = useState(null) // { ...puzzle, level, guess, wrong }
  const openPuzzle = useCallback(() => {
    if (!PUZZLE.active) return
    setPz({ ...makePuzzle(PUZZLE.level), level: PUZZLE.level, guess: '', wrong: null })
    release()
  }, [])
  const closePuzzle = () => {
    setPz(null)
    resume()
  }
  const answerPuzzle = (raw) => {
    if (checkAnswer(pz, raw)) {
      solvePuzzle()
      closePuzzle()
    } else setPz({ ...makePuzzle(pz.level), level: pz.level, guess: '', wrong: pz.explain })
  }
  // Ross Library: the Bloomberg Terminal and the mysterious book
  const [trading, setTrading] = useState(false)
  const [readingBook, setReadingBook] = useState(false)
  const openTerm = useCallback(() => {
    setTrading(true)
    release()
  }, [])
  const closeTerm = () => {
    setTrading(false)
    resume()
  }
  const openBook = useCallback(() => {
    setReadingBook(true)
    release()
  }, [])
  const closeBook = () => {
    setReadingBook(false)
    resume()
  }

  // the easter egg: a close-up of the MGT 409 poster; light up a big Y on its tiles
  const [poster, setPoster] = useState(null) // Set of lit tile indexes
  const openPoster = useCallback(() => {
    setPoster(new Set())
    release()
  }, [])
  const closePoster = () => {
    setPoster(null)
    resume()
  }
  const toggleTile = (k) =>
    setPoster((prev) => {
      if (!prev || prev.has('won')) return prev
      const next = new Set(prev)
      next.has(k) ? next.delete(k) : next.add(k)
      if (next.size === POSTER_Y.length && POSTER_Y.every((i) => next.has(i))) {
        next.add('won')
        setTimeout(() => {
          unlockBlaster()
          closePoster()
        }, 900)
      }
      return next
    })
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

  const hud = playing && !talkingTo && !over && !reading && !shopOpen && !admitOpen && !pz && !poster && !trading && !readingBook
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
      if (st.puzzleAim) return openPuzzle(), true
      if (st.posterAim) return openPoster(), true
      if (st.termAim) return openTerm(), true
      if (st.bookAim) return openBook(), true
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
  }, [openChat, openNote, openShop, openAdmit, openPuzzle, openPoster, openTerm, openBook])

  // the one thing under the crosshair you can interact with (zombies win; you swing at those)
  const target = zombie != null ? null : coffee ? 'coffee' : admissions ? 'admissions' : puzzleAim ? 'puzzle' : posterAim ? 'poster' : termAim ? 'term' : bookAim ? 'book' : vending ? 'vending' : note != null ? 'note' : aiming ? 'prof' : null
  const hint = {
    coffee: coffeeIn > 0 ? [`☕ The urn is refilling: ${coffeeIn}s`, null] : hp >= 100 ? ['☕ Coffee & snacks (you’re at full health)', null] : [`to grab coffee ☕ (+${COFFEE.heal} health)`, drinkCoffee],
    vending: ['to open the Endowment Office 🏛️', openShop],
    admissions: ['to visit Admissions 🎓 (recruit classmates)', openAdmit],
    puzzle: ['to open the Case Competition puzzle 🧩', openPuzzle],
    poster: ['to take a closer look 🖼️', openPoster],
    term: ['to log on to the Bloomberg Terminal 📈', openTerm],
    book: ['to open the mysterious book 📖', openBook],
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
          <span>
            🧟 Wave <b>{wave || 1}</b>
            <small> / {FINAL_WAVE}</small>
          </span>
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
          {Object.entries(heroes)
            .filter(([, pct]) => pct > 0)
            .map(([id, pct]) => (
              <span key={id}>
                {HEROES[id].icon} {HEROES[id].short} <b>{pct}%</b>
              </span>
            ))}
          {tuition && (
            <span className={tuition.probation ? 'alert' : ''}>
              {tuition.probation ? '⚠️ Probation' : '🎓 Tuition'} ${tuition.amount.toLocaleString()} due after wave {tuition.wave}
            </span>
          )}
          {compound > 0 && <span>💰 interest ×{compound}</span>}
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
      {playing && toasts.length > 0 && (
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast" style={{ animation: `toastin 0.2s ease-out, toastout 0.4s ease-in ${(t.ms - 400) / 1000}s forwards` }}>
              {t.text}
            </div>
          ))}
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
              <span>
                🧟 <b>{wave || 1}</b>/{FINAL_WAVE}
              </span>
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
            {Object.entries(heroes)
              .filter(([, pct]) => pct > 0)
              .map(([id, pct]) => (
                <span key={id}>
                  {HEROES[id].icon} {HEROES[id].short} {pct}%
                </span>
              ))}
            {tuition && (tuition.probation || tuition.wave - (wave || 1) <= 2) && (
              <span className={tuition.probation ? 'alert' : ''}>
                {tuition.probation ? '⚠️ Probation' : '🎓 Tuition'} ${Math.round(tuition.amount / 1000)}k · wave {tuition.wave}
              </span>
            )}
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
            {tuition && (
              <p className={tuition.probation ? 'tuitionline alert' : 'tuitionline'}>
                {tuition.probation
                  ? `⚠️ Academic Probation: $${tuition.amount.toLocaleString()} is due when you clear wave ${tuition.wave}, or you're expelled.`
                  : `🎓 Tuition installment ${tuition.n} of 5: $${tuition.amount.toLocaleString()}, billed when you clear wave ${tuition.wave}. Keep that much in the bank!`}
              </p>
            )}
            <div className="shopgrid">
              {[
                ...Object.entries(MELEE)
                  .filter(([id, w]) => id !== 'wsj' && !w.super)
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
              You have <b>{classmates}</b> classmate{classmates === 1 ? '' : 's'} fighting for you. Fallen classmates rise as Harvard zombies, so
              recruit replacements here. New recruits report in at this desk.
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
            <h3 className="shophead">🏛️ The Deans</h3>
            <p className="sub">Hire a Dean to fight at your side. They follow you, hit hard, and each has a special ability.</p>
            <div className="shopgrid">
              {Object.entries(HEROES).map(([id, h]) => {
                const onDuty = heroes[id] > 0
                return (
                  <div key={id} className={onDuty ? 'item owned' : 'item'}>
                    <div className="icon">{h.icon}</div>
                    <div>
                      <b>{h.name}</b>
                      <small>{onDuty ? `on duty · ${heroes[id]}% health` : `${h.hp} health`}</small>
                      <p>{h.desc}</p>
                    </div>
                    <button className="go" disabled={onDuty || endowment < h.price} onClick={() => hireHero(id)} aria-label={`Hire ${h.name}`}>
                      {onDuty ? 'On duty' : `$${h.price.toLocaleString()}`}
                    </button>
                  </div>
                )
              })}
            </div>
            <h3 className="shophead">🏋️ Classmate training</h3>
            <p className="sub">Upgrades every classmate, now and future. A new level opens after each boss (waves 4, 8, 12).</p>
            <div className="shopgrid">
              {Object.entries(TRAINING).map(([id, t]) => {
                const lvl = training[id] || 0
                const next = nextTraining(id)
                return (
                  <div key={id} className={next ? 'item' : 'item owned'}>
                    <div className="icon">{t.icon}</div>
                    <div>
                      <b>
                        {t.name} {'★'.repeat(lvl)}
                        {'☆'.repeat(t.prices.length - lvl)}
                      </b>
                      <small>{next ? (next.locked ? `level ${next.level} opens at wave ${next.locked}` : `level ${next.level}`) : 'maxed out'}</small>
                      <p>{t.desc}</p>
                    </div>
                    <button className="go" disabled={!next || !!next.locked || endowment < next.price} onClick={() => train(id)} aria-label={`Train: ${t.name}`}>
                      {!next ? 'Maxed' : next.locked ? `Wave ${next.locked}` : `$${next.price.toLocaleString()}`}
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="shopfoot">
              <button className="go" onClick={closeAdmit} autoFocus>
                Back to the fight
              </button>
            </div>
          </div>
        </div>
      )}

      {trading && <TradeGame endowment={endowment} onClose={closeTerm} />}

      {readingBook && (
        <div className="overlay notecard-wrap">
          <div className="card shop spellbook" role="dialog" aria-label="The mysterious book">
            <div className="kicker">📖 A mysterious book · Ross Library</div>
            <h2>Liber Lucis et Veritatis</h2>
            <p className="sub">
              Its pages are warm to the touch. Each spell costs Endowment. 💰 ${endowment.toLocaleString()}
            </p>
            <div className="shopgrid">
              {Object.entries(SPELLS).map(([id, sp]) => (
                <div key={id} className="item">
                  <div className="icon">{sp.icon}</div>
                  <div>
                    <b>{sp.name}</b>
                    <small>{sp.now ? 'works right away' : `a charge for your wheel${inv[id] ? ` · you have ${inv[id]}` : ''}`}</small>
                    <p>{sp.desc}</p>
                  </div>
                  <button className="go" disabled={endowment < sp.price} onClick={() => buySpell(id)} aria-label={`Learn ${sp.name}`}>
                    ${sp.price.toLocaleString()}
                  </button>
                </div>
              ))}
            </div>
            <div className="shopfoot">
              <button className="go alt" onClick={closeBook} autoFocus>
                Close the book
              </button>
            </div>
          </div>
        </div>
      )}

      {poster && (
        <div className="overlay notecard-wrap">
          <div className="card posterzoom" role="dialog" aria-label="MGT 409 poster">
            <div className="ptitle">MGT 409</div>
            <div className="psub">
              Lecture 13
              <br />
              Walk the floor.
            </div>
            <div className={poster.has('won') ? 'ptiles won' : 'ptiles'}>
              {POSTER_TILES.map((color, k) => (
                <button
                  key={k}
                  className={poster.has(k) ? 'lit' : ''}
                  style={{ background: color }}
                  onClick={() => toggleTile(k)}
                  aria-label={`Tile ${Math.floor(k / 5) + 1}, ${(k % 5) + 1}`}
                  aria-pressed={poster.has(k)}
                />
              ))}
            </div>
            <p className="phint">{poster.has('won') ? 'Boola boola!' : 'The tiles light up when you tap them. Mother Yale likes her initial big.'}</p>
            <div className="shopfoot">
              <button className="go alt" onClick={() => setPoster(new Set())}>
                Clear
              </button>
              <button className="go alt" onClick={closePoster}>
                Step back
              </button>
            </div>
          </div>
        </div>
      )}

      {pz && (
        <div className="overlay notecard-wrap">
          <div className="card shop puzzle" role="dialog" aria-label="Case Competition puzzle">
            <div className="kicker">🧩 Case Competition · level {pz.level}</div>
            <h2>{pz.title}</h2>
            {pz.wrong && <p className="wrong">Not quite ({pz.wrong}). Here's a fresh case:</p>}
            {pz.prompt.map((line, k) => (
              <p key={k} className="q">
                {line}
              </p>
            ))}
            {pz.kind === 'choice' ? (
              <div className="choices">
                {pz.options.map((o) => (
                  <button key={o} className="go alt" onClick={() => answerPuzzle(o)}>
                    {o}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="answer"
                onSubmit={(e) => {
                  e.preventDefault()
                  answerPuzzle(pz.guess)
                }}
              >
                <input
                  autoFocus
                  inputMode={pz.kind === 'code' ? 'numeric' : 'decimal'}
                  placeholder={pz.kind === 'code' ? 'vault code' : 'your answer'}
                  value={pz.guess}
                  onChange={(e) => setPz({ ...pz, guess: e.target.value })}
                  aria-label="Your answer"
                />
                <button className="go" type="submit" disabled={!pz.guess.trim()}>
                  Submit
                </button>
              </form>
            )}
            <div className="shopfoot">
              <button className="go alt" onClick={closePuzzle}>
                Not now
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

      {over?.won && (
        <div className="overlay boom won">
          <div className="card" role="alertdialog" aria-label="You won">
            <div className="kicker">Yale SOM · 50 years · 1976–2026</div>
            <h1 className="title">🎓 Evans Hall stands!</h1>
            <p className="sub">
              You held off Harvard for all {FINAL_WAVE} waves, one for every year of the Yale School of Management. Prof. Zaman still has his Labubu, Handsome
              Dan is very proud, and the Endowment has never looked better. Happy 50th, Yale SOM! Boola boola!
            </p>
            <div className="final">
              <div>
                <b>{over.wave}</b>
                <span>waves</span>
              </div>
              <div>
                <b>{over.kills}</b>
                <span>zombies down</span>
              </div>
              <div>
                <b>{over.classmates}</b>
                <span>classmates standing</span>
              </div>
            </div>
            <button className="go" onClick={fightAgain} autoFocus>
              Play again
            </button>
          </div>
        </div>
      )}

      {over && !over.won && (
        <div className="overlay boom">
          <div className="card" role="alertdialog" aria-label="Game over">
            <div className="kicker">Game over</div>
            <h1>{over.expelled ? '📜 Expelled!' : over.labubu ? '😱 Harvard escaped with the Labubu' : '🧟 Harvard took Evans Hall'}</h1>
            <p className="sub">
              {over.expelled
                ? `You couldn't cover the $${over.owed.toLocaleString()} tuition balance, and Yale SOM had to let you go. Maybe go easier on BoolaCoin next time.`
                : over.labubu
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
              answers are hidden around the building). ☕ Hurt? Grab coffee at the <b>snack table</b> in the south cloister (☕ on the map); 🎓 <b>Admissions</b> is right next to it. Fallen classmates rise as Harvard zombies, so recruit more there. 🏁 Survive <b>{FINAL_WAVE} waves</b>, one for each year of Yale SOM, to win, and pay your <b>tuition</b> ($52,000 every 10 waves). 👑 Every 4th wave brings a <b>boss</b>, and every 3rd hides a 🧩 <b>puzzle</b> that unlocks a super weapon. 😱 Don't let them steal the{' '}
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
