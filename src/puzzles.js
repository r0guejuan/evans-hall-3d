// Case Competition puzzles: business-school problems with fresh random numbers each time, harder at each
// level. Level 1 is multiple choice; 2-4 want a number; 5+ is a vault code built from several clues.
// makePuzzle(level) -> { title, prompt: [lines], kind: 'choice' | 'number' | 'code', options?, answer, tol?, explain }

const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
const pick = (a) => a[Math.floor(Math.random() * a.length)]
const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString()}`
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1])
const VENTURES = ['a pumpkin-spice food truck', 'a haunted-house pop-up', 'a costume rental shop', 'a candy-corn startup', 'a Yale hoodie stand', 'a late-night pizza delivery']

// ---------- level 1: profit, multiple choice
function profit() {
  const units = ri(4, 12) * 50
  const price = ri(3, 9)
  const fixed = ri(2, 8) * 100
  const varCost = ri(1, price - 1)
  const answer = units * (price - varCost) - fixed
  const wrong = [units * price - fixed, units * (price - varCost), units * price - units * varCost + fixed]
  const options = shuffle([...new Set([answer, ...wrong])].slice(0, 4)).map((v) => money(v))
  return {
    title: 'Trick-or-Treat P&L',
    prompt: [`You run ${pick(VENTURES)}. Tonight you sold ${units} items at ${money(price)} each.`, `Each item costs ${money(varCost)} to make, and rent for the night is ${money(fixed)}.`, 'What was your profit?'],
    kind: 'choice',
    options,
    answer: money(answer),
    explain: `${units} × (${money(price)} − ${money(varCost)}) − ${money(fixed)} = ${money(answer)}`,
  }
}

// ---------- level 2: break-even or ROI
function breakEven() {
  const margin = ri(2, 9)
  const units = ri(3, 12) * 25
  const fixed = margin * units
  const varCost = ri(1, 6)
  const v = pick(VENTURES)
  return {
    title: 'Break-Even Night',
    prompt: [`${v[0].toUpperCase() + v.slice(1)} has fixed costs of ${money(fixed)}.`, `Each sale is ${money(varCost + margin)}, and each costs ${money(varCost)} to make.`, 'How many sales to break even?'],
    kind: 'number',
    answer: units,
    explain: `${money(fixed)} ÷ (${money(varCost + margin)} − ${money(varCost)}) = ${units} sales`,
  }
}
function roi() {
  const cost = ri(2, 9) * 1000
  const pct = pick([10, 20, 25, 30, 40, 50, 60, 75])
  const gain = cost + (cost * pct) / 100
  return {
    title: 'The Endowment Committee',
    prompt: [`The committee invested ${money(cost)} in a spooky-season fund.`, `It's now worth ${money(gain)}.`, 'What was the return on investment, in percent?'],
    kind: 'number',
    answer: pct,
    explain: `(${money(gain)} − ${money(cost)}) ÷ ${money(cost)} = ${pct}%`,
  }
}

// ---------- level 3: compounding and present value
function compound() {
  const p = ri(1, 9) * 1000
  const r = pick([5, 10, 20])
  const n = ri(2, 3)
  const answer = Math.round(p * (1 + r / 100) ** n)
  return {
    title: 'Mother Yale Compounds',
    prompt: [`You put ${money(p)} in an account paying ${r}% a year, compounded yearly.`, `How much is in it after ${n} years? (nearest dollar)`],
    kind: 'number',
    answer,
    tol: 1,
    explain: `${money(p)} × ${(1 + r / 100).toFixed(2)}^${n} = ${money(answer)}`,
  }
}
function presentValue() {
  const f = ri(2, 9) * 1100
  const r = 10
  const n = ri(1, 2)
  const answer = Math.round(f / (1 + r / 100) ** n)
  return {
    title: 'Time Value of Candy',
    prompt: [`A sponsor promises ${money(f)} in ${n} year${n > 1 ? 's' : ''}.`, `At a ${r}% discount rate, what is that worth today? (nearest dollar)`],
    kind: 'number',
    answer,
    tol: 1,
    explain: `${money(f)} ÷ 1.10^${n} = ${money(answer)}`,
  }
}

// ---------- level 4: equilibrium, NPV
function equilibrium() {
  const P = ri(3, 12)
  const b = ri(2, 6)
  const d = ri(2, 6)
  const c = ri(5, 30)
  const Q = c + d * P
  const a = Q + b * P
  return {
    title: 'The Candy Market',
    prompt: ['Halloween candy in New Haven:', `Demand: Qd = ${a} − ${b}P`, `Supply: Qs = ${c} + ${d}P`, 'What is the equilibrium price P?'],
    kind: 'number',
    answer: P,
    explain: `${a} − ${b}P = ${c} + ${d}P → P = ${a - c} ÷ ${b + d} = ${P} (and Q = ${Q})`,
  }
}
function npv() {
  const cf = ri(3, 9) * 1000
  const inv = ri(5, 15) * 1000
  const r = 0.1
  const pv = cf / 1.1 + cf / 1.21 + cf / 1.331
  const answer = Math.round(pv - inv)
  return {
    title: 'Should Yale Build the Haunted House?',
    prompt: [`It costs ${money(inv)} today and brings in ${money(cf)} at the end of each of the next 3 years.`, 'At a 10% discount rate, what is the NPV? (nearest dollar; can be negative)'],
    kind: 'number',
    answer,
    tol: 2,
    explain: `${money(cf)}/1.1 + ${money(cf)}/1.21 + ${money(cf)}/1.331 − ${money(inv)} ≈ ${money(answer)}`,
  }
}

// ---------- level 5+: the vault code, one digit per clue
function vault(level) {
  const clues = []
  const digits = []
  // payback period
  const yrs = ri(2, 9)
  const yearly = ri(2, 9) * 500
  clues.push(`Digit 1: the payback period, in years, of a ${money(yrs * yearly)} investment that returns ${money(yearly)} a year.`)
  digits.push(yrs)
  // break-even in hundreds
  const be = ri(1, 9)
  const m = ri(2, 8)
  clues.push(`Digit 2: break-even sales, in hundreds, with ${money(be * 100 * m)} of fixed costs and a ${money(m)} margin per sale.`)
  digits.push(be)
  // ROI in tens of percent
  const roiT = ri(1, 9)
  const cost = ri(2, 8) * 1000
  clues.push(`Digit 3: the ROI, in tens of percent, of turning ${money(cost)} into ${money(cost + (cost * roiT * 10) / 100)}.`)
  digits.push(roiT)
  if (level >= 6) {
    // price elasticity, as a whole number
    const e = ri(1, 4)
    const dp = pick([5, 10, 20])
    clues.push(`Digit 4: the price elasticity of demand (as a positive number) when a ${dp}% price rise cuts sales by ${dp * e}%.`)
    digits.push(e)
  }
  const answer = digits.join('')
  return {
    title: 'The Skull & Bones Vault',
    prompt: [`The vault takes a ${digits.length}-digit code. Each clue gives one digit:`, ...clues],
    kind: 'code',
    answer,
    explain: `The code is ${answer}.`,
  }
}

export function makePuzzle(level) {
  if (level <= 1) return profit()
  if (level === 2) return pick([breakEven, roi])()
  if (level === 3) return pick([compound, presentValue])()
  if (level === 4) return pick([equilibrium, npv])()
  return vault(level)
}

export function checkAnswer(pz, raw) {
  if (pz.kind === 'choice') return raw === pz.answer
  if (pz.kind === 'code') return String(raw).replace(/\D/g, '') === pz.answer
  const n = Number(String(raw).replace(/[$,%\s]/g, '').replace(/[−–]/g, '-'))
  return Number.isFinite(n) && Math.abs(n - pz.answer) <= (pz.tol || 0)
}
