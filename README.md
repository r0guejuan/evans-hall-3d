# Crimson Tide of the Dead

A first-person Halloween zombie game set on the 2nd floor of Edward P. Evans Hall (Yale School of Management), built with React, Vite, three.js, and @react-three/fiber.

It's Halloween night (jack-o'-lanterns, cobwebs, bats, hanging ghosts, string lights, a RIP Harvard graveyard in the courtyard lit by fire pits and string lights, a Yale-style SOM balloon sign in orange and black outside room 2200, and lightning that lights up the whole building), and Harvard zombies (crimson sweaters, white H, glowing eyes) are loose in the halls, in waves that grow bigger and tougher. A squad of Yale classmates in Yale-themed Halloween costumes (Skull & Bones, a Handsome Dan onesie, Nathan Hale, the Ghost of Elihu Yale, a Boola-Boola pumpkin, a Peabody Museum mummy, the Vampire of Sterling Library, the Witch of Harkness Tower, a Yale Bowl quarterback, a Headless Whiffenpoof, and the Grim Reaper of Finals Week) roam the cloister hunting them, while the zombies hunt them back and some come straight for you. Handsome Dan fights at your side, unlocking Bark Stun, Bulldog Charge, Boola Boola Howl, and Golden Dan as the kill count climbs.

- **The goal:** survive 50 waves, one for each year of Yale SOM (1976–2026), to win.
- **Tuition:** the program costs $260,000, billed $52,000 at a time when you clear waves 10, 20, 30, 40, and 50. Short? Everything you have goes toward it and you're on Academic Probation: half your classmates take a leave of absence, and the rest (plus a 10% late fee) is due when you clear the next wave. Miss that and you're expelled.
- **Endowment:** kills earn Endowment dollars to spend between waves at the Endowment Office (the glowing vending machine by Ross Library, or **B**): the Briefcase Bash, boxes of 25 Business Card Shuriken ($1,000 a box), Coffee Thermos Grenades, Hostile Takeovers, and Market Crashes (`src/weapons.js`).
- **Classmates:** you start with 10. A classmate who falls and isn't saved within a few seconds rises as a Harvard zombie (faded Yale sweater, green face), so recruit more at the 🎓 Admissions desk next to the coffee table ($500 each, or 5 for $2,250), any time, even mid-wave. The 🎓 counter shows how many are fighting for you. Admissions can also hire **the Deans**: 🌟 Assistant Dean Wendy Tsung ($20,000; her Student Affairs Rally heals classmates, gets a fallen one back up, and tops up your health) and 📊 Dean Kerwin Charles ($40,000; the hardest hitter, with an Economic Shock that stuns crowds). They follow you and fight; if one is overwhelmed, hire them again. After each boss, Admissions also sells a new level of classmate training: 💪 Payne Whitney Gym (+50% health), 🥊 Yale Boxing Club (+50% punch), 👟 Track & Field (+15% speed).
- **Harvard's lineup:** Freshmen (crimson H sweaters), 🏃 Crimson Sprinters (wave 2+, fast but fragile), 🍮 Hasty Pudding Chefs (wave 3+, keep their distance and lob puddings), 💪 Final Club Bruisers (wave 5+, huge, slow, triple health, barely budge), and 🎭 Mimics: every Labubu thief is disguised as a Yale student (classmates don't notice one until it's right next to them), but the green face and glowing eyes give it away.
- **Bosses:** every 4th wave brings a crowned boss zombie, tougher each time. Tier 1 (wave 4) ground-slams; tier 2 (wave 8) also calls in Harvard alumni; tier 3 (wave 12) also hurls crimson bolts from range (dodge them, or duck behind a wall); tier 4+ also charges at you, with wider volleys.
- **Case Competition puzzles:** every 3rd wave a glowing golden case file appears somewhere in the halls (❓ on the map). Solve its business-school problem (fresh numbers every time, harder each level: profit, break-even and ROI, compounding and present value, equilibrium and NPV, then multi-clue vault codes) to unlock a super weapon: 🔨 Golden Gavel, 💸 Money Cannon, 🦢 Black Swan Event, 🏛️ The Endowment. Past level 4, a solved puzzle refills them all (`src/puzzles.js`).
- **Ross Library:** has a Bloomberg Terminal (one trade per wave: pick a ticker from blue chip to BoolaCoin, stake up to all your Endowment, and sell before the market closes) and a mysterious book of spells for sale.
- **Easter egg:** somewhere in Evans Hall, a piece of art is worth a closer look. Walk the floor.
- **Power-ups:** chat with Prof. Zaman (room 2200) or Prof. Schott (2210) and hit **⚡ Earn a power-up**. Answer their course question (graded on the server, see `backend/quiz.py`) to win weapons, spells, shields, potions, and more. Stuck? They'll tell you where in Evans Hall a study note has the answer (`src/notes.js`).
- **Coffee:** hurt? Grab coffee and a donut at the snack table in the south cloister (☕ on the map) for +35 health; the urn takes 25 seconds to refill.
- **The Labubu:** every wave sends Labubu thieves (wave N sends N, marked with red dots) after the Labubu on Prof. Zaman's pants. Once one grabs it, a blood-red 90-second countdown starts: drop the thief, walk over the Labubu to pick it up, and carry it back to Prof. Zaman (+$500) before time runs out, or Harvard wins. Careful: a thief that touches you snatches it back.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Click to walk in**. Add `?classic` to the URL to turn off shadows and post-processing on slow computers.

### The professors (backend)

Each professor is a PydanticAI agent (`backend/`) whose prompt is built from their courses and bio in `data/yale_som.db`, with tools to search the whole course database and to run the power-up quizzes. Calls go through Portkey. The backend reads `PORTKEY_API_KEY` from the `.env` in the AI Foundations folder; `backend/.env` can override settings like `OPENAI_MODEL` (see `backend/.env.example`).

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8000
```

The Vite dev server proxies `/api` to port 8000. The GitHub Pages build has no backend, so chat and power-ups only work locally.

## Controls

| Key | Action |
| --- | --- |
| W A S D | walk |
| ← → ↑ ↓ (or mouse) | look |
| Shift / C | sprint / crouch |
| Space (or left click) | melee |
| L (or right click) | your long-range pick |
| hold Tab | weapon wheel (time slows; flick the mouse toward a weapon, release to equip) |
| Q | sic 'em, Dan |
| E (or click) | talk / read a note / grab coffee / open the shop |
| B | Endowment Office (between waves) |
| M / Esc | map / pause |

**Phone / tablet:** tap **Tap to walk in**. The left-thumb joystick walks and dragging anywhere else looks around. Under your right thumb, the big red **HIT** button swings, the one beside it throws (with your ammo count), 🎯 opens the weapon wheel, and 🐶 sends Dan. A slim strip on top shows the wave, kills, health, Endowment, and Dan's level, with pause, map, and sound buttons. Phones automatically get lighter graphics so they run smoothly; sideways is the best view. On a laptop, click **Use on-screen joystick** to try the phone controls.

## How it's built

- `src/Rivals.jsx`: the game: waves, Harvard zombies and costumed Yale students (instanced rigs posed by hand each frame), their roam-and-hunt AI, Handsome Dan's companion AI and abilities, weapons, power-ups, the Labubu heist, the Endowment Office vending machine, the coffee table, and study notes.
- `src/nav.js`: the cloister loop everyone navigates by, plus each classroom's door route.
- `src/layout.js`: the floor plan in meters (+x east, -z north): drums, library, Beinecke, stairs, meeting rooms, wall colliders, and room lookup.
- `src/Heroes.jsx`: the Deans you can hire. `src/TradeGame.jsx`: the Bloomberg Terminal mini-game. `src/Decor.jsx`: the Halloween decor. `src/puzzles.js`: the Case Competition puzzle generator.
- `src/World.jsx`: all the meshes, the night lighting (moonlight, fog, flickering ceiling lights), and scanned materials. `src/Nature.jsx`: leafy trees and the photo-scanned potted plant.
- `src/Faculty.jsx`, `src/Zaman.jsx`, `src/Schott.jsx`, `src/avatarKit.jsx`: the two professors; `src/ChatWindow.jsx` + `src/chat.js`: chatting with them.
- `src/HandsomeDan.jsx`: your companion. `src/Labubu.jsx`: the Labubu on Zaman's pants (and in the thief's arms).
- `src/Hands.jsx`: first-person hands with your gear and the flashlight. `src/WeaponWheel.jsx`: the weapon wheel. `src/weapons.js`: the arsenal. `src/sfx.js`: synthesized sound.
- `src/Player.jsx`, `src/TouchControls.jsx`, `src/Minimap.jsx`: movement, phone controls, and the map.

The layout is estimated from the wayfinding plan posted on the floor, so room sizes are approximate. Scanned textures, the HDRI, and the plant model are CC0; see `public/textures/CREDITS.md`.

Made for MGT 409: AI Foundations for Managers.
