import { useEffect, useRef, useState } from 'react'
import { CHAT_PROFESSORS, askProfessor, chat } from './chat.js'
import { applyPowerUp } from './Rivals.jsx'

// conversations survive closing and reopening the window (until the page reloads)
const histories = {}

export default function ChatWindow({ id, onClose }) {
  const prof = CHAT_PROFESSORS[id]
  const [msgs, setMsgs] = useState(() => (histories[id] ??= [{ role: 'prof', text: prof.greeting }]))
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const input = useRef()
  const list = useRef()

  useEffect(() => {
    histories[id] = msgs
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [id, msgs, busy])
  useEffect(() => input.current?.focus(), [])

  const send = async (text = draft.trim()) => {
    if (!text || busy) return
    setDraft('')
    setError(null)
    setMsgs((m) => [...m, { role: 'you', text }])
    setBusy(true)
    try {
      const { reply, power_ups: earned = [] } = await askProfessor(id, text)
      setMsgs((m) => [...m, { role: 'prof', text: reply }, ...earned.map((pu) => ({ role: 'power', text: `⚡ Power-up unlocked: ${pu.name}. ${pu.description}` }))])
      earned.forEach(applyPowerUp)
      chat.set({ speakingUntil: performance.now() + Math.min(9000, 1200 + reply.length * 35) })
    } catch (e) {
      const offline = e instanceof TypeError // fetch itself failed: backend not running
      setError({ text, message: offline ? "Can't reach the professor. Is the backend running?" : e.message })
    } finally {
      setBusy(false)
      input.current?.focus()
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose(false)
    }
  }

  return (
    <div className="chat" role="dialog" aria-label={`Chat with ${prof.name}`}>
      <header className="chat-head">
        <div>
          <div className="kicker">{prof.room} · {prof.course}</div>
          <h2>{prof.name}</h2>
        </div>
        <button className="chat-close" onClick={() => onClose(true)} aria-label="Close chat and keep walking">
          ✕
        </button>
      </header>

      <div className="chat-list" ref={list} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="bubble prof typing" aria-label={`${prof.name} is typing`}>
            <span />
            <span />
            <span />
          </div>
        )}
        {error && (
          <div className="chat-error" role="alert">
            {error.message}
            <button onClick={() => (setMsgs((m) => m.slice(0, -1)), send(error.text))}>Try again</button>
          </div>
        )}
      </div>

      <button className="powerask" disabled={busy} onClick={() => send('Can I earn a power-up?')}>
        ⚡ Earn a power-up
      </button>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          ref={input}
          rows={1}
          value={draft}
          placeholder="Ask about the class, courses, anything…"
          aria-label={`Message ${prof.name}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={4000}
        />
        <button className="go" type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
      <div className="chat-tip">Enter to send · Shift+Enter for a new line · Esc to close</div>
    </div>
  )
}
