// The arsenal, business school edition. Kills earn Endowment dollars; between waves you spend them
// at the Endowment Office vending machine (or press B). Stats are used by Rivals.jsx; Hands.jsx draws them.

export const MELEE = {
  wsj: { name: 'Rolled-up WSJ', icon: '🗞️', price: 0, damage: 1, range: 2.4, cooldown: 0.35, stun: 0.6, knock: 0.6, desc: 'Fast, light swats. Every hit stuns for a moment.' },
  briefcase: { name: 'Briefcase Bash', icon: '💼', price: 1500, damage: 4, range: 2.7, cooldown: 0.9, stun: 0.3, knock: 3, sweep: 3, desc: 'Slow, heavy swing. Big damage and sends zombies flying.' },
  // super weapon: only from a solved Case Competition puzzle (never sold)
  gavel: { name: 'Golden Gavel', icon: '🔨', super: true, damage: 9, range: 3.3, cooldown: 0.55, stun: 1, knock: 1.5, sweep: 6, desc: 'A solid-gold gavel: huge damage to everything in front of you, and a one-second stun.' },
}

// sold by the box: each purchase is a box of `pack` cards
export const SHURIKEN = { name: 'Business Card Shuriken', icon: '📇', price: 1000, pack: 25, damage: 2, speed: 26, range: 30, cooldown: 0.3, pierce: 3, desc: 'A box of 25 embossed cards. Fast, accurate, and each one slices through up to 3 zombies.' }

// consumables: bought by the each; pick one on the weapon wheel, use it with L / right click
export const ITEMS = {
  thermos: { name: 'Coffee Thermos Grenade', icon: '☕', price: 400, desc: 'Lob a scalding thermos: splash damage, and zombies keep burning for a few seconds.' },
  takeover: { name: 'Hostile Takeover', icon: '🤝', price: 1200, desc: 'Aim at a zombie to flip it: it fights for Yale for 15 seconds, then collapses.' },
  crash: { name: 'Market Crash', icon: '📉', price: 3000, desc: 'Every zombie slows to a crawl and bleeds value for 12 seconds.' },
}

export const THERMOS = { radius: 4, damage: 5, burn: 1.2, burnTime: 4, speed: 11 }
export const TAKEOVER = { range: 16, time: 15 }
export const CRASH = { time: 12, slow: 0.4, dps: 0.9 }

// Endowment for each kill (plus a bonus for a Labubu thief, and a big one for a boss)
export const bounty = (wave, thief, boss) => (boss ? 1500 * boss : thief ? 300 : 100 + wave * 20)

// the Admissions desk (by the coffee table): fallen classmates are gone for good, so you recruit more
export const ADMIT = { one: 500, five: 2250 }

// classmate training, bought at Admissions. Level n unlocks at wave 4n (so: after each boss).
export const TRAINING = {
  gym: { name: 'Payne Whitney Gym', icon: '💪', desc: 'Classmates get +50% health per level (and current ones heal up).', prices: [1500, 3000, 5000] },
  boxing: { name: 'Yale Boxing Club', icon: '🥊', desc: 'Classmates punch +50% harder per level.', prices: [1500, 3000, 5000] },
  track: { name: 'Track & Field', icon: '👟', desc: 'Classmates move 15% faster per level, to catch thieves.', prices: [1200, 2500, 4000] },
}
export const TRAIN_EVERY = 4 // level n needs wave >= 4n

// ---------- super weapons: unlocked by solving the Case Competition puzzles that appear every 3rd wave.
// Puzzle level n unlocks the level-n weapon; past level 4, a solved puzzle refills all of them.
export const PUZZLE_EVERY = 3
export const SUPERS = {
  gavel: { level: 1, name: 'Golden Gavel', icon: '🔨', kind: 'melee', desc: MELEE.gavel.desc },
  cannon: { level: 2, name: 'Money Cannon', icon: '💸', kind: 'ranged', ammo: 12, desc: 'Fires exploding bundles of cash: a huge blast. 12 shots.' },
  swan: { level: 3, name: 'Black Swan Event', icon: '🦢', kind: 'ranged', ammo: 2, desc: 'For 6 seconds, lightning strikes the zombies around you. 2 uses.' },
  endowment: { level: 4, name: 'The Endowment', icon: '🏛️', kind: 'ranged', ammo: 1, desc: "Unleash Yale's endowment: every zombie in the building takes massive damage (bosses lose 30%). 1 use." },
}
export const CANNON = { radius: 5, damage: 11, speed: 14 }
export const SWAN = { time: 6, every: 0.4, range: 16, damage: 5, strikes: 3 }

// ---------- the Deans: hero characters you can hire at Admissions. Tougher than classmates, they follow
// you, fight, and each has a special ability. Overwhelmed? They're gone until you hire them again.
export const HEROES = {
  tsung: {
    name: 'Assistant Dean Wendy Tsung',
    short: 'Dean Tsung',
    icon: '🌟',
    price: 20000,
    hp: 40,
    punch: 1.6,
    desc: 'Student Affairs Rally: every 8 seconds she heals the classmates around her, gets a fallen one back on their feet, and gives you +10 health.',
  },
  charles: {
    name: 'Dean Kerwin Charles',
    short: 'Dean Charles',
    icon: '📊',
    price: 40000,
    hp: 60,
    punch: 3,
    desc: 'Economic Shock: when zombies crowd him, every 10 seconds a shockwave damages and stuns them all. The hardest hitter in Evans Hall.',
  },
}

// ---------- the easter egg: light up a big Y on the MGT 409 poster (east cloister) for the Ticker Tape
// Blaster, a handheld stock ticker that fires glowing green up-arrows trailing ticker tape. 20 shots that
// refill one every 9 seconds (3 minutes for a full load): a burst to save for when you need it.
export const BLASTER = { name: 'Ticker Tape Blaster', icon: '📈', damage: 2.5, speed: 40, range: 35, cooldown: 0.16, pierce: 2, charges: 20, recharge: 9 } // 9 s per shot: a full recharge takes 3 minutes
// the Y, on the poster's 5-column x 6-row grid of tiles (row-major, top row first)
export const POSTER_Y = [0, 4, 6, 8, 12, 17, 22, 27]
