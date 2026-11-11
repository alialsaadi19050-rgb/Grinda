// Menyn i Stigens stil. På datorn en sidomeny till vänster med färgade ikonrutor och en rad
// överst med ämne, streak och XP. På mobil och surfplatta en flikrad längst ner med de
// viktigaste sidorna och ”Mer” för resten.
import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { BookOpen, Chart, Dumbbell, Flame, Gear, Gem, Home, Lightbulb, Moon, More, Shield, Sigma, Sun, Users } from '../design/icons.tsx'
import { openThemeEditor, PaletteIcon, setTheme, useTheme } from '../design/ThemeEditor.tsx'
import { resolveMode } from '../design/theme.ts'
import { SUBJECTS, setSubject, useSubject } from '../subject/subject.ts'
import { useInbox } from '../social/api.ts'
import { useCanInvite } from '../vault/InviteTab.tsx'
import { useGame } from '../game/useGame.ts'
import './nav.css'

export type NavPage = 'home' | 'chapter' | 'learn' | 'practice' | 'formulas' | 'friends' | 'stats' | 'admin'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
interface Item {
  id: NavPage
  label: string
  href: string
  Icon: Icon
  /** Ikonrutans färg (en av Stigens färger). */
  color: string
  /** Visas i flikraden längst ner på mobil (annars under ”Mer”). */
  tab?: boolean
}

export function Nav({ streak, onSettings, active, firstChapter }: { streak: number; onSettings: () => void; active: NavPage; firstChapter: number }) {
  const subject = useSubject()
  const inbox = useInbox()
  const unread = Object.values(inbox.unread).reduce((s, n) => s + n, 0)
  const isAdmin = useCanInvite()
  const game = useGame()
  const theme = useTheme()
  const mode = resolveMode(theme.mode)
  const [more, setMore] = useState(false)

  useEffect(() => {
    if (!more) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setMore(false)
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [more])

  const items: Item[] = [
    { id: 'home', label: 'Stigen', href: '#/hem', Icon: Home, color: 'accent', tab: true },
    { id: 'chapter', label: 'Kapitel', href: `#/kapitel/${firstChapter}`, Icon: BookOpen, color: 'sky' },
    { id: 'learn', label: 'Lär dig', href: '#/lar', Icon: Lightbulb, color: 'sun', tab: true },
    { id: 'practice', label: 'Öva', href: '#/ova', Icon: Dumbbell, color: 'mint', tab: true },
    { id: 'formulas', label: 'Formler', href: '#/formler', Icon: Sigma, color: 'sun' },
    { id: 'friends', label: 'Kompisar', href: '#/kompisar', Icon: Users, color: 'coral', tab: true },
    { id: 'stats', label: 'Statistik', href: '#/statistik', Icon: Chart, color: 'sky' },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', href: '#/admin', Icon: Shield, color: 'coral' }] : []),
  ]
  const badge = (id: NavPage) => (id === 'friends' && unread > 0 ? <b className="nv-badge">{unread}</b> : null)
  const rest = items.filter((i) => !i.tab)
  const moreActive = rest.some((i) => i.id === active)
  const toggleMode = () => setTheme({ mode: mode === 'dark' ? 'light' : 'dark' })
  const pick = (s: typeof subject) => {
    if (s === subject) return
    setSubject(s)
    location.hash = '#/hem'
  }

  return (
    <>
      <header className="nv">
        <a className="nv-logo" href="#/hem" aria-label="Grinda – till startsidan">
          <i aria-hidden="true">g</i>
          <span>grinda</span>
        </a>
        <div className="nv-subjects" role="radiogroup" aria-label="Ämne">
          {SUBJECTS.map((s) => (
            <button key={s.id} role="radio" aria-checked={subject === s.id} className={subject === s.id ? 'on' : ''} onClick={() => pick(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <div className="nv-right">
          <a className="nv-pill fire" href="#/statistik" title="Dagar i rad">
            <Flame size={18} /> {streak}
          </a>
          {game && (
            <a className="nv-pill gem" href="#/statistik" title={`Nivå ${game.level.level}: ${game.level.name}`}>
              <Gem size={17} /> {game.xp.toLocaleString('sv-SE')}
            </a>
          )}
          <button className="nv-icon" onClick={toggleMode} aria-label={mode === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'} title={mode === 'dark' ? 'Ljust läge' : 'Mörkt läge'}>
            {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button className="nv-icon" aria-label="Inställningar" title="Inställningar" onClick={onSettings}>
            <Gear size={19} />
          </button>
        </div>
      </header>

      {/* Dator: sidomenyn */}
      <nav className="nv-side" aria-label="Huvudmeny">
        <a className="nv-logo" href="#/hem" aria-label="Grinda – till startsidan">
          <i aria-hidden="true">g</i>
          <span>grinda</span>
        </a>
        {items.map(({ id, label, href, Icon, color }) => (
          <a key={id} className={active === id ? 'on' : ''} href={href} aria-current={active === id ? 'page' : undefined}>
            <span className={`nv-tile c-${color}`}>
              <Icon size={20} />
            </span>
            {label}
            {badge(id)}
          </a>
        ))}
        <button className="nv-side-extra" onClick={openThemeEditor}>
          <span className="nv-tile c-muted">
            <PaletteIcon />
          </span>
          Färger
        </button>
      </nav>

      {/* Mobil och surfplatta */}
      <nav className="nv-tabs" aria-label="Huvudmeny">
        {items
          .filter((i) => i.tab)
          .map(({ id, label, href, Icon }) => (
            <a key={id} className={active === id ? 'on' : ''} href={href} aria-current={active === id ? 'page' : undefined}>
              <span className="nv-tab-icon">
                <Icon size={22} />
                {badge(id)}
              </span>
              <span>{label}</span>
            </a>
          ))}
        <button className={moreActive || more ? 'on' : ''} onClick={() => setMore((m) => !m)} aria-expanded={more}>
          <span className="nv-tab-icon">
            <More size={22} />
          </span>
          <span>Mer</span>
        </button>
      </nav>
      {more && (
        <div className="nv-sheet-backdrop" onClick={() => setMore(false)}>
          <div className="nv-sheet" role="dialog" aria-label="Mer" onClick={(e) => e.stopPropagation()}>
            <span className="nv-sheet-handle" aria-hidden="true" />
            {rest.map(({ id, label, href, Icon, color }) => (
              <a key={id} className={active === id ? 'on' : ''} href={href} onClick={() => setMore(false)}>
                <span className={`nv-tile c-${color}`}>
                  <Icon size={20} />
                </span>
                {label}
              </a>
            ))}
            <div className="nv-sheet-subjects">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  className={subject === s.id ? 'on' : ''}
                  onClick={() => {
                    setMore(false)
                    pick(s.id)
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setMore(false)
                openThemeEditor()
              }}
            >
              <span className="nv-tile c-muted">
                <PaletteIcon />
              </span>
              Färger
            </button>
            <button
              onClick={() => {
                setMore(false)
                onSettings()
              }}
            >
              <span className="nv-tile c-muted">
                <Gear size={20} />
              </span>
              Inställningar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
