// The arsenal, business school edition. Kills earn Endowment dollars; between waves you spend them
// at the Endowment Office vending machine (or press B). Stats are used by Rivals.jsx; Hands.jsx draws them.

export const MELEE = {
  wsj: { name: 'Rolled-up WSJ', icon: '🗞️', price: 0, damage: 1, range: 2.4, cooldown: 0.35, stun: 0.6, knock: 0.6, desc: 'Fast, light swats. Every hit stuns for a moment.' },
  briefcase: { name: 'Briefcase Bash', icon: '💼', price: 1500, damage: 4, range: 2.7, cooldown: 0.9, stun: 0.3, knock: 3, desc: 'Slow, heavy swing. Big damage and sends zombies flying.' },
}

export const SHURIKEN = { name: 'Business Card Shuriken', icon: '📇', price: 900, damage: 2, speed: 26, range: 30, cooldown: 0.3, pierce: 3, desc: 'Flick embossed cards. Fast, accurate, and they slice through up to 3 zombies.' }

// consumables: bought by the each; pick one on the weapon wheel, use it with L / right click
export const ITEMS = {
  thermos: { name: 'Coffee Thermos Grenade', icon: '☕', price: 400, desc: 'Lob a scalding thermos: splash damage, and zombies keep burning for a few seconds.' },
  takeover: { name: 'Hostile Takeover', icon: '🤝', price: 1200, desc: 'Aim at a zombie to flip it: it fights for Yale for 15 seconds, then collapses.' },
  crash: { name: 'Market Crash', icon: '📉', price: 3000, desc: 'Every zombie slows to a crawl and bleeds value for 12 seconds.' },
}

export const THERMOS = { radius: 4, damage: 5, burn: 1.2, burnTime: 4, speed: 11 }
export const TAKEOVER = { range: 16, time: 15 }
export const CRASH = { time: 12, slow: 0.4, dps: 0.9 }

// Endowment for each kill (plus a bonus for the Labubu thief)
export const bounty = (wave, thief) => (thief ? 600 : 100 + wave * 20)
