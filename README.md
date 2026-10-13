# Crimson Tide of the Dead

A first-person Halloween zombie game set on the 2nd floor of Edward P. Evans Hall (Yale School of Management), built with React, Vite, three.js, and @react-three/fiber.

It's night, and Harvard zombies (crimson sweaters, white H, glowing eyes) are loose in the halls, in waves that grow bigger and tougher. A squad of 25 Yale students in Yale-themed Halloween costumes (Skull & Bones, a Handsome Dan onesie, Nathan Hale, the Ghost of Elihu Yale, a Boola-Boola pumpkin, a Peabody Museum mummy, the Vampire of Sterling Library, the Witch of Harkness Tower, a Yale Bowl quarterback, a Headless Whiffenpoof, and the Grim Reaper of Finals Week) roam the cloister hunting them, while the zombies hunt them back and some come straight for you. Handsome Dan fights at your side, unlocking Bark Stun, Bulldog Charge, Boola Boola Howl, and Golden Dan as the kill count climbs.

- **Endowment:** kills earn Endowment dollars to spend between waves at the Endowment Office (the glowing vending machine by Ross Library, or **B**): the Briefcase Bash, Business Card Shuriken, Coffee Thermos Grenades, Hostile Takeovers, and Market Crashes (`src/weapons.js`).
- **Power-ups:** chat with Prof. Zaman (room 2200) or Prof. Schott (2210) and hit **⚡ Earn a power-up**. Answer their course question (graded on the server, see `backend/quiz.py`) to win weapons, spells, shields, potions, and more. Stuck? They'll tell you where in Evans Hall a study note has the answer (`src/notes.js`).
- **Coffee:** hurt? Grab coffee and a donut at the snack table in the south cloister (☕ on the map) for +35 health; the urn takes 25 seconds to refill.
- **The Labubu:** from wave 2 a thief zombie goes for the Labubu on Prof. Zaman's pants. Once it grabs it, a blood-red 90-second countdown starts: kill the thief to get the Labubu back, or Harvard escapes with it and the game is over.

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
- `src/World.jsx`: all the meshes, the night lighting (moonlight, fog, flickering ceiling lights), and scanned materials. `src/Nature.jsx`: leafy trees and the photo-scanned potted plant.
- `src/Faculty.jsx`, `src/Zaman.jsx`, `src/Schott.jsx`, `src/avatarKit.jsx`: the two professors; `src/ChatWindow.jsx` + `src/chat.js`: chatting with them.
- `src/HandsomeDan.jsx`: your companion. `src/Labubu.jsx`: the Labubu on Zaman's pants (and in the thief's arms).
- `src/Hands.jsx`: first-person hands with your gear and the flashlight. `src/WeaponWheel.jsx`: the weapon wheel. `src/weapons.js`: the arsenal. `src/sfx.js`: synthesized sound.
- `src/Player.jsx`, `src/TouchControls.jsx`, `src/Minimap.jsx`: movement, phone controls, and the map.

The layout is estimated from the wayfinding plan posted on the floor, so room sizes are approximate. Scanned textures, the HDRI, and the plant model are CC0; see `public/textures/CREDITS.md`.

Made for MGT 409: AI Foundations for Managers.
