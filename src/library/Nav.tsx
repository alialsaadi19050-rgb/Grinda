// Menyn. På datorn en rad överst med ikoner; på mobil och surfplatta en flikrad längst ner
// med de viktigaste sidorna och ”Mer” för resten.
import { useEffect, useState, type ComponentType, type SVGProps } from 'react'
import { BookOpen, Chart, Dumbbell, Flame, Gear, Home, Lightbulb, Moon, More, Shield, Sigma, Sun, Swap, Users } from '../design/icons.tsx'
import { openThemeEditor, PaletteIcon, setTheme, useTheme } from '../design/ThemeEditor.tsx'
import { resolveMode } from '../design/theme.ts'
import { subjectName, useSubject } from '../subject/subject.ts'
import { useInbox } from '../social/api.ts'
import { useCanInvite } from '../vault/InviteTab.tsx'
import './nav.css'

export type NavPage = 'home' | 'chapter' | 'learn' | 'practice' | 'formulas' | 'friends' | 'stats' | 'admin'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
interface Item {
  id: NavPage
  label: string
  href: string
  Icon: Icon
  /** Visas i flikraden längst ner på mobil (annars under ”Mer”). */
  tab?: boolean
}

export function Nav({ streak, onSettings, active, firstChapter }: { streak: number; onSettings: () => void; active: NavPage; firstChapter: number }) {
  const subject = useSubject()
  const inbox = useInbox()
  const unread = Object.values(inbox.unread).reduce((s, n) => s + n, 0)
  const isAdmin = useCanInvite()
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
    { id: 'home', label: 'Hem', href: '#/hem', Icon: Home, tab: true },
    { id: 'chapter', label: 'Kapitel', href: `#/kapitel/${firstChapter}`, Icon: BookOpen },
    { id: 'learn', label: 'Lär dig', href: '#/lar', Icon: Lightbulb, tab: true },
    { id: 'practice', label: 'Öva', href: '#/ova', Icon: Dumbbell, tab: true },
    { id: 'formulas', label: 'Formler', href: '#/formler', Icon: Sigma },
    { id: 'friends', label: 'Kompisar', href: '#/kompisar', Icon: Users, tab: true },
    { id: 'stats', label: 'Statistik', href: '#/statistik', Icon: Chart },
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', href: '#/admin', Icon: Shield }] : []),
  ]
  const badge = (id: NavPage) => (id === 'friends' && unread > 0 ? <b className="nv-badge">{unread}</b> : null)
  const rest = items.filter((i) => !i.tab)
  const moreActive = rest.some((i) => i.id === active)
  const toggleMode = () => setTheme({ mode: mode === 'dark' ? 'light' : 'dark' })

  return (
    <>
      <header className="nv">
        <a className="nv-logo" href="#/hem" aria-label="Grinda – till startsidan">
          grinda<span>.</span>
        </a>
        <a className="nv-subject" href="#/" title="Byt ämne">
          {subjectName(subject)}
          <Swap size={14} />
        </a>
        <nav className="nv-links" aria-label="Huvudmeny">
          {items.map(({ id, label, href, Icon }) => (
            <a key={id} className={active === id ? 'on' : ''} href={href} aria-current={active === id ? 'page' : undefined}>
              <Icon size={17} />
              <span>{label}</span>
              {badge(id)}
            </a>
          ))}
        </nav>
        <div className="nv-right">
          <a className="nv-streak" href="#/statistik" title="Dagar i rad">
            <Flame size={15} /> {streak}
          </a>
          <button className="nv-icon" onClick={toggleMode} aria-label={mode === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'} title={mode === 'dark' ? 'Ljust läge' : 'Mörkt läge'}>
            {mode === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button className="nv-icon" aria-label="Inställningar" title="Inställningar" onClick={onSettings}>
            <Gear size={19} />
          </button>
        </div>
      </header>

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
            {rest.map(({ id, label, href, Icon }) => (
              <a key={id} className={active === id ? 'on' : ''} href={href} onClick={() => setMore(false)}>
                <Icon size={21} />
                {label}
              </a>
            ))}
            <a href="#/" onClick={() => setMore(false)}>
              <Swap size={21} />
              Byt ämne ({subjectName(subject)})
            </a>
            <button
              onClick={() => {
                setMore(false)
                openThemeEditor()
              }}
            >
              <PaletteIcon />
              Färger
            </button>
            <button
              onClick={() => {
                setMore(false)
                onSettings()
              }}
            >
              <Gear size={21} />
              Inställningar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
