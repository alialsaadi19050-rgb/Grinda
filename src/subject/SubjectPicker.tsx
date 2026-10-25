// Startsidan efter inloggningen: två stora flikar, Fysik 2 och Matte 5.
import { CoverArt } from '../design/Cover.tsx'
import { setSubject, SUBJECTS } from './subject.ts'
import './subject.css'

export function SubjectPicker() {
  return (
    <main className="sp">
      <div className="sp-logo">
        grinda<span>.</span>
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
            <CoverArt motif={s.id === 'fysik' ? 'mix' : 'boxes'} seed={`amne-${s.id}`} width={600} height={400} />
            <span className="sp-name">{s.name}</span>
          </a>
        ))}
      </div>
    </main>
  )
}
