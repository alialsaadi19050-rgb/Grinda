// Knappar för tecken som är krångliga att skriva på tangentbordet: potenser, bråk, rot, π,
// grader och tiopotenser. Används i läget utan ritplatta.
import type { MathInputHandle } from './MathInput.tsx'

const KEYS: { label: string; title: string; latex: string; text: string }[] = [
  { label: 'x²', title: 'Kvadrat', latex: '^2', text: '^2' },
  { label: 'xⁿ', title: 'Potens', latex: '^{#?}', text: '^' },
  { label: 'a⁄b', title: 'Bråk', latex: '\\frac{#@}{#?}', text: '/' },
  { label: '√', title: 'Kvadratrot', latex: '\\sqrt{#?}', text: '√(' },
  { label: 'π', title: 'Pi', latex: '\\pi', text: 'π' },
  { label: '°', title: 'Grader', latex: '\\degree', text: '°' },
  { label: '·10ⁿ', title: 'Gånger tio upphöjt till', latex: '\\cdot10^{#?}', text: '·10^' },
]

export function KeyHelper({ target, label = 'Teckenhjälp' }: { target: () => MathInputHandle | null | undefined; label?: string }) {
  return (
    <div className="ex-keyhelp" role="toolbar" aria-label={label}>
      {KEYS.map((k) => (
        <button
          key={k.label}
          type="button"
          tabIndex={-1}
          title={k.title}
          aria-label={k.title}
          // Behåll fokus i svarsrutan när man klickar.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => target()?.insert(k.latex, k.text)}
        >
          {k.label}
        </button>
      ))}
    </div>
  )
}

/** Tecken för enhetsfältet. */
export const UNIT_SYMBOLS = ['²', '³', '/', '·', '°', 'µ']
