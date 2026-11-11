// Startsidan efter inloggningen: två stora flikar, Fysik 2 och Matte 5.
import { setSubject, SUBJECTS, type Subject } from './subject.ts'
import './subject.css'

export function SubjectPicker() {
  return (
    <main className="sp">
      <div className="sp-logo">
        <i aria-hidden="true">g</i>grinda
      </div>
      <p className="sp-lead">Vad vill du plugga idag?</p>
      <div className="sp-grid">
        {SUBJECTS.map((s) => (
          <a
            key={s.id}
            className={`sp-card sp-${s.id}`}
            href="#/hem"
            onClick={() => setSubject(s.id)}
          >
            <SubjectArt subject={s.id} />
            <span className="sp-name">{s.name}</span>
            <span className="sp-go">Kör igång</span>
          </a>
        ))}
      </div>
    </main>
  )
}

/** Enkel bild för ämnet: en våg för fysik, en formel med prickar för matte. */
function SubjectArt({ subject }: { subject: Subject }) {
  return subject === 'fysik' ? (
    <svg className="sp-art" viewBox="0 0 300 140" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" aria-hidden="true">
      <path d="M10 70c25-50 50-50 70 0s45 50 70 0 45-50 70 0 45 50 70 0" />
      <circle cx="80" cy="70" r="11" fill="currentColor" stroke="none" />
    </svg>
  ) : (
    <svg className="sp-art" viewBox="0 0 300 140" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" aria-hidden="true">
      <circle cx="115" cy="70" r="44" />
      <circle cx="185" cy="70" r="44" />
      <circle cx="150" cy="70" r="7" fill="currentColor" stroke="none" />
    </svg>
  )
}
