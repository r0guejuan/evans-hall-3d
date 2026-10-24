// Which level you're playing: 🎃 Halloween Night (the default) or 🦃 Thanksgiving Day. It comes from the
// link (?theme=thanksgiving) so it's shareable, and it's fixed for the whole visit: switching levels on the
// start card reloads the page with the other theme (World, Decor, the Harvard rig and the lighting are all
// built once at load).
const param = new URLSearchParams(location.search).get('theme')
export const THEME = param === 'thanksgiving' ? 'thanksgiving' : 'halloween'
export const FALL = THEME === 'thanksgiving'

// what the enemies are called in messages
export const FOE = FALL ? 'turkeys' : 'zombies'
export const FOE1 = FALL ? 'turkey' : 'zombie'

export const TITLE = FALL ? 'Crimson Tide: The Turkey Trot' : 'Crimson Tide of the Dead'
document.title = TITLE // the browser tab

export function switchTheme(next) {
  const url = new URL(location.href)
  if (next === 'thanksgiving') url.searchParams.set('theme', 'thanksgiving')
  else url.searchParams.delete('theme')
  location.href = url.toString()
}
