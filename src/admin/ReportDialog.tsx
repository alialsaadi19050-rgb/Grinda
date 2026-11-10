// ”Rapportera fel” på en uppgift (bara för admin): fel i facit, tryckfel, figur som saknas …
import { useEffect, useRef, useState } from 'react'
import type { Exercise } from '../content/types.ts'
import { attemptsFor } from '../storage/db.ts'
import { createReport } from './api.ts'
import '../social/social.css'
import './admin.css'

const QUICK = ['Fel i facit', 'Rättningen godkänner inte rätt svar', 'Tryckfel i uppgiften', 'Figuren saknas eller är fel', 'Fel enhet']

export function ReportDialog({ ex, onClose }: { ex: Exercise; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [part, setPart] = useState<number | null>(ex.parts.length === 1 ? 0 : null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const mine = (await attemptsFor(ex.id)).filter((a) => (part === null || a.part === part) && a.input).slice(-5)
      const p = part === null ? null : ex.parts[part]
      await createReport(ex.id, part, p?.label ?? null, message.trim(), {
        number: ex.number,
        section: ex.section,
        facit: p?.facit,
        answers: mine.map((a) => `${a.label ? `${a.label}) ` : ''}${a.input} → ${a.status}`),
        url: location.href,
      })
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    }
    setBusy(false)
  }

  return (
    <dialog ref={dialog} className="so-dialog" onClose={onClose} onClick={(e) => e.target === dialog.current && onClose()}>
      <div className="so-dialog-inner">
        <header>
          <h2>Rapportera fel i {ex.number}</h2>
          <button className="st-close" onClick={onClose} aria-label="Stäng">
            ×
          </button>
        </header>
        {done ? (
          <div className="so-done">
            <p>Tack! Rapporten är sparad. ✓</p>
            <p className="so-help">Du hittar den under Admin → Felrapporter. Be Claude att rätta den.</p>
            <button className="mk-btn-primary" onClick={onClose}>
              Klar
            </button>
          </div>
        ) : (
          <div className="ad-report-form">
            {ex.parts.length > 1 && (
              <div className="st-seg" role="radiogroup" aria-label="Vilken deluppgift">
                <button className={part === null ? 'on' : ''} onClick={() => setPart(null)}>
                  Hela uppgiften
                </button>
                {ex.parts.map((p, i) => (
                  <button key={i} className={part === i ? 'on' : ''} onClick={() => setPart(i)}>
                    {p.label ?? i + 1})
                  </button>
                ))}
              </div>
            )}
            <div className="so-pick">
              {QUICK.map((q) => (
                <button key={q} onClick={() => setMessage((m) => (m ? `${m} ${q}.` : `${q}.`))}>
                  {q}
                </button>
              ))}
            </div>
            <textarea className="so-input" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Vad är fel? T.ex. ”Facit säger 3,2 men boken säger 2,3” eller ”Mitt svar 0,07 kN/m godkändes inte”." maxLength={3000} autoFocus />
            <p className="so-help">Dina senaste svar på uppgiften skickas med, så att felet går att återskapa.</p>
            {error && <p className="so-error">{error}</p>}
            <button className="mk-btn-primary so-send" disabled={busy || !message.trim()} onClick={submit}>
              {busy ? 'Skickar …' : 'Skicka rapporten'}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
