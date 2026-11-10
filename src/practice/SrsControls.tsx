// Inställningar för repetitionen: av/på, intervallen steg för steg och hur många per dag.
import '../settings/settings.css'
import { SRS_PRESETS, updateSettings, useSettings, type SrsSettings } from '../settings/settings.ts'

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

export function SrsControls() {
  const { srs } = useSettings()
  const set = (patch: Partial<SrsSettings>) => updateSettings({ srs: { ...srs, ...patch } })
  const setStep = (i: number, v: number) => set({ intervals: srs.intervals.map((d, j) => (j === i ? Math.min(365, Math.max(1, Math.round(v) || 1)) : d)) })

  return (
    <div className="srs-controls">
      <label className="st-switch">
        <input type="checkbox" checked={srs.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span>Repetera uppgifter jag fått fel på</span>
      </label>
      {srs.enabled && (
        <>
          <h4>Hur ofta?</h4>
          <div className="st-seg">
            {SRS_PRESETS.map((p) => (
              <button key={p.id} className={same(p.intervals, srs.intervals) ? 'on' : ''} onClick={() => set({ intervals: p.intervals })} title={`${p.intervals.join(', ')} dagar`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="srs-steps" role="group" aria-label="Dagar mellan repetitionerna">
            <span className="srs-step-label">Fel</span>
            {srs.intervals.map((d, i) => (
              <span key={i} className="srs-step">
                <span className="srs-arrow" aria-hidden="true">
                  →
                </span>
                <label>
                  <input type="number" min={1} max={365} value={d} onChange={(e) => setStep(i, Number(e.target.value))} aria-label={`Steg ${i + 1}: antal dagar`} />
                  <span>{d === 1 ? 'dag' : 'dagar'}</span>
                </label>
                {srs.intervals.length > 1 && (
                  <button className="srs-remove" onClick={() => set({ intervals: srs.intervals.filter((_, j) => j !== i) })} aria-label={`Ta bort steg ${i + 1}`} title="Ta bort steget">
                    ×
                  </button>
                )}
              </span>
            ))}
            <span className="srs-arrow" aria-hidden="true">
              →
            </span>
            <span className="srs-step-label">Klar</span>
            {srs.intervals.length < 8 && (
              <button className="st-secondary" onClick={() => set({ intervals: [...srs.intervals, Math.min(365, (srs.intervals.at(-1) ?? 1) * 2)] })}>
                + Lägg till steg
              </button>
            )}
          </div>
          <p className="st-help">
            Efter ett fel kommer uppgiften tillbaka efter {srs.intervals[0]} {srs.intervals[0] === 1 ? 'dag' : 'dagar'}. Klarar du den utan fel den dagen eller senare går den vidare till nästa steg, och efter sista steget är den klar. Får du fel igen
            börjar den om från början.
          </p>
          <h4>Högst per dag</h4>
          <div className="st-seg">
            {[5, 10, 20, 0].map((n) => (
              <button key={n} className={srs.maxPerDay === n ? 'on' : ''} onClick={() => set({ maxPerDay: n })}>
                {n || 'Alla'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
