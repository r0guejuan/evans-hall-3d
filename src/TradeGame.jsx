import { useEffect, useRef, useState } from 'react'
import { STAKES, TICKERS, TRADE_SECONDS } from './weapons.js'
import { canTrade, tradeSettle, tradeStart } from './Rivals.jsx'

// The Bloomberg Terminal's mini-game: one trade per wave. Pick a ticker and a stake, then watch the live
// chart and SELL whenever you like; the market closes (and sells for you) after TRADE_SECONDS.
// Prices take a random walk (riskier tickers swing harder and sometimes jump), with no edge either way
// on average, so it's a real gamble.

const TICK = 0.1 // seconds per price update
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
const money = (n) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`

export default function TradeGame({ endowment, onClose }) {
  const [phase, setPhase] = useState(canTrade() ? 'pick' : 'closed') // pick | live | done | closed
  const [ticker, setTicker] = useState(TICKERS[1])
  const [frac, setFrac] = useState(STAKES[1])
  const [series, setSeries] = useState([100])
  const [stake, setStake] = useState(0)
  const [result, setResult] = useState(null)
  const live = useRef(null)
  const priceRef = useRef(100) // the latest price (state updaters stay pure; the money moves here)
  const stakeRef = useRef(0)
  const sold = useRef(false)

  const sell = () => {
    if (sold.current) return // one payout per trade, even if the clock and your click land together
    sold.current = true
    clearInterval(live.current)
    live.current = null
    const p = priceRef.current
    const value = (stakeRef.current * p) / 100
    tradeSettle(value)
    setResult({ value, pnl: value - stakeRef.current, pct: p - 100 })
    setPhase('done')
  }
  const sellRef = useRef(sell)
  sellRef.current = sell

  const buy = () => {
    const amount = Math.floor(endowment * frac)
    if (!tradeStart(amount)) return
    setStake(amount)
    stakeRef.current = amount
    priceRef.current = 100
    sold.current = false
    setSeries([100])
    setPhase('live')
    let t = 0
    live.current = setInterval(() => {
      t += TICK
      let p = priceRef.current * Math.exp(ticker.vol * Math.sqrt(TICK) * gauss() - (ticker.vol * ticker.vol * TICK) / 2)
      if (Math.random() < ticker.jump) p *= Math.random() < 0.5 ? 0.55 : 1.7 // news hits
      priceRef.current = Math.max(1, p)
      setSeries((s) => [...s, priceRef.current])
      if (t >= TRADE_SECONDS) sellRef.current()
    }, TICK * 1000)
  }
  useEffect(() => () => clearInterval(live.current), [])

  // the chart
  const W = 320
  const H = 150
  const lo = Math.min(90, ...series)
  const hi = Math.max(110, ...series)
  const xOf = (i) => (i / ((TRADE_SECONDS / TICK) | 0)) * W
  const yOf = (p) => H - ((p - lo) / (hi - lo)) * H
  const price = series.at(-1)
  const up = price >= 100
  const left = Math.max(0, TRADE_SECONDS - (series.length - 1) * TICK)

  return (
    <div className="overlay notecard-wrap">
      <div className="card terminal" role="dialog" aria-label="Bloomberg Terminal">
        <div className="tbar">
          <b>BLOOMBERG</b> <span>Ross Library · {money(endowment)} available</span>
        </div>
        {phase === 'closed' && <p className="tmsg">Market's closed: you already traded this wave. Come back next wave.</p>}
        {phase === 'pick' && (
          <>
            <p className="tmsg">Pick a ticker and a stake. Then SELL whenever you like; the market closes in {TRADE_SECONDS} seconds.</p>
            <div className="tgrid">
              {TICKERS.map((t) => (
                <button key={t.id} className={t === ticker ? 'on' : ''} onClick={() => setTicker(t)}>
                  <b>{t.id}</b>
                  <small>{t.name}</small>
                  <em>{t.risk}</em>
                </button>
              ))}
            </div>
            <div className="tstakes">
              {STAKES.map((f) => (
                <button key={f} className={f === frac ? 'on' : ''} onClick={() => setFrac(f)}>
                  {f === 1 ? 'ALL IN' : `${f * 100}%`}
                  <small>{money(endowment * f)}</small>
                </button>
              ))}
            </div>
            <button className="go" disabled={Math.floor(endowment * frac) < 100} onClick={buy}>
              BUY {ticker.id} · {money(endowment * frac)}
            </button>
          </>
        )}
        {(phase === 'live' || phase === 'done') && (
          <>
            <div className="tquote">
              <b>{ticker.id}</b>
              <span className={up ? 'up' : 'down'}>
                {price.toFixed(2)} {up ? '▲' : '▼'} {(price - 100).toFixed(1)}%
              </span>
              <span>{phase === 'live' ? `${left.toFixed(1)}s` : 'closed'}</span>
            </div>
            <svg className="tchart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Price chart">
              <line x1="0" x2={W} y1={yOf(100)} y2={yOf(100)} className="base" />
              <polyline points={series.map((p, i) => `${xOf(i)},${yOf(p)}`).join(' ')} className={up ? 'up' : 'down'} />
            </svg>
            {phase === 'live' ? (
              <button className="go sell" onClick={sell}>
                SELL · {money((stake * price) / 100)}
              </button>
            ) : (
              <p className={result.pnl >= 0 ? 'tresult up' : 'tresult down'}>
                {result.pnl >= 0 ? '📈 Profit' : '📉 Loss'}: {money(result.pnl)} ({result.pct >= 0 ? '+' : ''}
                {result.pct.toFixed(1)}%). You get {money(result.value)}.
              </p>
            )}
          </>
        )}
        {phase !== 'live' && (
          <div className="shopfoot">
            <button className="go alt" onClick={onClose} autoFocus>
              Log off
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
