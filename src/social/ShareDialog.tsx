// Dela en uppgift med en kompis, med eller utan din uträkning (skrivytan eller det du skrivit
// med tangentbordet).
import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../content/types.ts'
import { loadDrawing } from '../storage/db.ts'
import { fetchBoard, myId, refreshInbox, send, useInbox, type Friend } from './api.ts'
import './social.css'

export function ShareDialog({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const inbox = useInbox()
  const dialog = useRef<HTMLDialogElement>(null)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [body, setBody] = useState('')
  const [withWork, setWithWork] = useState(true)
  const [preview, setPreview] = useState<{ image?: string; notes?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  useEffect(() => {
    if (inbox.joined) fetchBoard().then(setFriends, (e: Error) => setError(e.message))
  }, [inbox.joined])
  // Din uträkning: en bild av skrivytan och/eller texten du skrivit.
  useEffect(() => {
    loadDrawing(ex.id).then(async (d) => {
      let image: string | undefined
      if (d?.strokes.length) {
        const { snapshotForAi } = await import('../canvas/export.ts')
        image = (await snapshotForAi(d.strokes))?.dataUrl
      }
      setPreview(image || d?.notes?.trim() ? { image, notes: d?.notes?.trim() || undefined } : null)
    })
  }, [ex.id])

  const mine = inbox.me?.name
  const list = (friends ?? []).filter((f) => f.user_id !== myId() && f.name !== mine && f.name.toLowerCase().includes(query.trim().toLowerCase()))
  // Kompisar du skrivit med nyligen hamnar först.
  const me = myId()
  const recent = [...new Set([...inbox.messages].reverse().map((m) => (m.from_id === me ? m.to_id : m.from_id)))]
  const ordered = [...list].sort((a, b) => (recent.indexOf(a.user_id) + 1 || 999) - (recent.indexOf(b.user_id) + 1 || 999))

  const share = async () => {
    if (!to) return
    setBusy(true)
    setError(null)
    try {
      const work = withWork && preview
      await send(to, work ? 'work' : 'exercise', body.trim(), {
        exerciseId: ex.id,
        number: ex.number,
        title: ex.topic,
        ...(work ? { image: preview.image, notes: preview.notes } : {}),
      })
      void refreshInbox()
      setDone(friends?.find((f) => f.user_id === to)?.name ?? 'kompisen')
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <dialog ref={dialog} className="so-dialog" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <div className="so-dialog-inner">
        <header>
          <h2>Dela uppgift {ex.number}</h2>
          <button className="st-close" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </header>
        {inbox.joined === false ? (
          <p className="so-help">
            Du behöver ett visningsnamn för att dela med kompisar. <a href="#/kompisar">Välj ett under Kompisar</a>.
          </p>
        ) : done ? (
          <div className="so-done">
            <p>Skickat till {done}! ✓</p>
            <div className="so-row">
              <a className="mk-btn-ghost" href={`#/kompisar/${to}`} onClick={onClose}>
                Öppna chatten
              </a>
              <button className="mk-btn-primary" onClick={onClose}>
                Klar
              </button>
            </div>
          </div>
        ) : (
          <>
            <input className="so-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök kompis …" aria-label="Sök kompis" />
            <div className="so-pick">
              {!friends ? (
                <p className="so-help">Hämtar kompisar …</p>
              ) : !ordered.length ? (
                <p className="so-help">Inga kompisar hittades. Be dem välja ett visningsnamn under Kompisar.</p>
              ) : (
                ordered.map((f) => (
                  <button key={f.user_id} className={to === f.user_id ? 'on' : ''} onClick={() => setTo(f.user_id)}>
                    <span className="so-avatar">{f.name.slice(0, 1).toUpperCase()}</span>
                    {f.name}
                  </button>
                ))
              )}
            </div>
            {preview ? (
              <label className="so-check">
                <input type="checkbox" checked={withWork} onChange={(e) => setWithWork(e.target.checked)} />
                <span>Skicka med min uträkning</span>
              </label>
            ) : (
              <p className="so-help">Du har ingen uträkning på den här uppgiften än – bara uppgiften skickas.</p>
            )}
            {preview && withWork && (
              <div className="so-preview">
                {preview.image && <img src={preview.image} alt="Din uträkning" />}
                {preview.notes && <pre>{preview.notes}</pre>}
              </div>
            )}
            <textarea className="so-input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Skriv något, t.ex. ”Hur fick du b)?”" rows={2} maxLength={2000} />
            {error && <p className="so-error">{error}</p>}
            <button className="mk-btn-primary so-send" disabled={!to || busy} onClick={share}>
              {busy ? 'Skickar …' : 'Skicka'}
            </button>
          </>
        )}
      </div>
    </dialog>
  )
}
