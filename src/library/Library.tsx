import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { filterContent, useSubject } from '../subject/subject.ts'
import type { Exercise, Lesson } from '../content/types.ts'
import { loadContentOnce, type Content } from '../content/load.ts'
import { Bolt, BookOpen, Bookmark, Check, ChevronLeft, ChevronRight, Flame, Play, Star, Trophy, Undo } from '../design/icons.tsx'
import { savedFirst, useBookmarks } from '../bookmarks/bookmarks.ts'
import { lessonHref, useLessons } from '../lessons/data.ts'
import { startRedoSession } from '../exercise/redoSession.ts'
import { useLessonProgress } from '../lessons/progress.ts'
import { MathText } from '../ui/MathText.tsx'
import { Figure } from '../ui/Figure.tsx'
import { ThemeEditor } from '../design/ThemeEditor.tsx'
import { SettingsDialog } from '../settings/SettingsDialog.tsx'
import { useSrsToday } from '../game/GameStrip.tsx'
import { useGame } from '../game/useGame.ts'
import { weekSentence } from '../game/game.ts'
import { useSettings } from '../settings/settings.ts'
import { fetchBoard, useInbox, type Friend } from '../social/api.ts'
import '../game/game.css'
import { AnnouncementBanner } from '../admin/AnnouncementBanner.tsx'
import { Nav as NavBar, type NavPage } from './Nav.tsx'
import '../social/social.css'
import { recommend, useProgress, type Progress, type Status } from '../progress/progress.ts'
import './library.css'
import './stigen-home.css'

/** Bokens innehåll. Som standard bara det valda ämnets kapitel (Fysik 2 eller Matte 5). */
export function useContent(scope: 'subject' | 'all' = 'subject') {
  const [content, setContent] = useState<Content | null>(null)
  const subject = useSubject()
  useEffect(() => {
    loadContentOnce().then(setContent)
  }, [])
  return useMemo(() => (content && scope === 'subject' ? filterContent(content, subject) : content), [content, scope, subject])
}

export const exerciseHref = (id: string) => `#/uppgift/${encodeURIComponent(id)}`
export const sectionLabel = (s: { section: string; title: string }) => (s.section.includes('.') ? `${s.section} ${s.title}` : s.title)

/** Låter kortets nummer ”flyga” in till uppgiftssidan (View Transitions). */
export function markTransition(e: React.MouseEvent<HTMLElement>) {
  document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]').forEach((el) => (el.style.viewTransitionName = ''))
  const num = e.currentTarget.querySelector<HTMLElement>('[data-vt="num"]')
  if (num) num.style.viewTransitionName = 'ex-num'
}

export function Library() {
  const content = useContent()
  const bookmarks = useBookmarks()
  const lessons = useLessons()?.filter((l) => content?.index.chapters.some((c) => c.id === l.chapter))
  const lp = useLessonProgress()
  const progress = useProgress(content?.exercises)
  const [settingsOpen, setSettingsOpen] = useState<false | 'tablet' | 'study'>(false)
  if (!content || !progress) return <div className="mk-loading">Laddar …</div>

  const { exercises } = content
  const st = (e: Exercise) => progress.byExercise[e.id].status
  const featured = recommend(exercises, progress)
  const resume = [
    ...exercises.filter((e) => st(e) === 'attempted').sort((a, b) => progress.byExercise[b.id].lastAt - progress.byExercise[a.id].lastAt),
    ...exercises.slice(Math.max(0, exercises.indexOf(featured))).filter((e) => st(e) === 'new').slice(0, 6),
  ].filter((e, i, all) => all.indexOf(e) === i)
  // Allt du fått fel på någon gång och inte gjort om felfritt: mest missade först.
  const redo = exercises.filter((e) => progress.byExercise[e.id].needsRedo).sort((a, b) => progress.byExercise[b.id].wrong - progress.byExercise[a.id].wrong || progress.byExercise[b.id].lastAt - progress.byExercise[a.id].lastAt)
  const saved = savedFirst(exercises, bookmarks)

  return (
    <div className="mk">
      <Nav streak={progress.streakDays} onSettings={() => setSettingsOpen('tablet')} active="home" />
      <main className="sg-home">
        <AnnouncementBanner />
        <div className="sg-grid">
          <div className="sg-main">
            <Hero ex={featured} progress={progress} sectionTitle={content.sections.find((s) => s.section === featured.section)} onGoal={() => setSettingsOpen('study')} />
            {content.index.chapters.map((c) => (
              <ChapterPath key={c.id} chapter={c} content={content} progress={progress} lessons={lessons ?? []} lessonDone={(id) => !!lp[id]?.done} featured={featured} redo={redo.filter((e) => e.chapter === c.id)} />
            ))}
          </div>
          <SideColumn exercises={exercises} onGoal={() => setSettingsOpen('study')} />
        </div>

        <div className="mk-rows sg-rows">
          <Row title={progress.solvedTotal || resume.some((e) => st(e) === 'attempted') ? 'Fortsätt där du slutade' : 'Börja här'}>
            {resume.map((e) => (
              <Tile key={e.id} ex={e} progress={progress} />
            ))}
          </Row>
          {redo.length > 0 && (
            <Row
              title="Gör om"
              href="#/ova"
              note="Uppgifter du fått fel på. Gör om dem utan fel så försvinner de härifrån."
              meta={
                <button className="mk-redo-start" onClick={() => startRedoSession(redo.map((e) => e.id))}>
                  <Play size={14} /> Starta repetition ({redo.length})
                </button>
              }
            >
              {redo.map((e) => (
                <Tile key={e.id} ex={e} progress={progress} />
              ))}
            </Row>
          )}
          {saved.length > 0 && (
            <Row title="Sparade till senare" note="Tryck på bokmärket på en uppgift för att spara eller ta bort den.">
              {saved.map((e) => (
                <Tile key={e.id} ex={e} progress={progress} />
              ))}
            </Row>
          )}
        </div>
        <footer className="mk-foot">Innehållet är avskrivet från din egen bok för eget bruk. Allt du gör sparas bara i den här webbläsaren – gör en backup under Inställningar → Data.</footer>
      </main>
      {settingsOpen && <SettingsDialog initialTab={settingsOpen} onClose={() => setSettingsOpen(false)} />}
      <ThemeEditor />
    </div>
  )
}

export type { NavPage }

/** Menyn, med rätt kapitel för det valda ämnet. */
export function Nav(props: { streak: number; onSettings: () => void; active: NavPage }) {
  const subject = useSubject()
  const content = useContent()
  const firstChapter = content?.index.chapters[0]?.id ?? (subject === 'fysik' ? 102 : 1)
  return <NavBar {...props} firstChapter={firstChapter} />
}

function Hero({ ex, progress, sectionTitle, onGoal }: { ex: Exercise; progress: Progress; sectionTitle?: { section: string; title: string }; onGoal: () => void }) {
  const game = useGame()
  const { dailyGoal } = useSettings()
  const inbox = useInbox()
  const p = progress.byExercise[ex.id]
  const name = inbox.me?.name?.split(' ')[0]
  const today = game?.today ?? 0
  const left = Math.max(0, dailyGoal - today)
  const title = dailyGoal > 0 ? (left === 0 ? 'Dagens mål är klart!' : left === 1 ? 'En till så är dagens mål klart.' : `${left} till så är dagens mål klart.`) : 'Dags att räkna!'
  const where = sectionTitle ? sectionLabel(sectionTitle) : ex.topic
  const r = 50
  const c = 2 * Math.PI * r
  const share = dailyGoal > 0 ? Math.min(1, today / dailyGoal) : 0
  return (
    <section className="sg-hero">
      <span className="sg-blob a" aria-hidden="true" />
      <span className="sg-blob b" aria-hidden="true" />
      <div className="sg-hero-copy">
        <h1>
          Hej{name ? ` ${name}` : ''}! {title}
        </h1>
        <p>
          {p.status === 'attempted' ? 'Du är mitt i' : progress.solvedTotal ? 'Nästa steg:' : 'Börja med'} {where}. Uppgift {ex.number}
          {ex.parts.length > 1 ? ` har ${ex.parts.length} delar.` : '.'}
        </p>
        <a className="sg-go" href={exerciseHref(ex.id)} onClick={(e) => markTransition(e as never)}>
          <Play size={16} /> {p.status === 'attempted' ? 'Kör vidare' : progress.solvedTotal ? 'Nästa uppgift' : 'Kör igång'}
        </a>
      </div>
      <button className="sg-ring" onClick={onGoal} title="Ändra dagens mål" aria-label={`Dagens mål: ${today} av ${dailyGoal}. Tryck för att ändra.`}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="t" cx="60" cy="60" r={r} />
          <circle className="f" cx="60" cy="60" r={r} strokeDasharray={`${c * share} ${c}`} />
        </svg>
        <span>
          <b>{dailyGoal > 0 ? `${Math.min(today, dailyGoal)}/${dailyGoal}` : today}</b>
          <small>idag</small>
        </span>
      </button>
    </section>
  )
}

type NodeKind = 'lesson' | 'set' | 'redo' | 'trophy'
interface PathNode {
  key: string
  kind: NodeKind
  label: string
  sub?: string
  href?: string
  onClick?: () => void
  state: 'done' | 'current' | 'open' | 'later'
}

/** Ett kapitel som en stig: genomgång och uppgifter för varje område, i bokens ordning. */
function ChapterPath({ chapter, content, progress, lessons, lessonDone, featured, redo }: { chapter: Content['index']['chapters'][number]; content: Content; progress: Progress; lessons: Lesson[]; lessonDone: (id: string) => boolean; featured: Exercise; redo: Exercise[] }) {
  const sections = content.sections.filter((s) => s.exercises[0]?.chapter === chapter.id)
  const nodes: PathNode[] = []
  let solved = 0
  let total = 0
  // Samma genomgång visas bara första gången dess område dyker upp (t.ex. inte igen bland blandade uppgifter).
  const shown = new Set<string>()
  for (const s of sections) {
    // Områdena i avsnittet, i den ordning uppgifterna kommer.
    const topics = [...new Set(s.exercises.map((e) => e.topic ?? ''))]
    for (const topic of topics) {
      const exs = s.exercises.filter((e) => (e.topic ?? '') === topic)
      const done = exs.filter((e) => progress.byExercise[e.id].status === 'correct').length
      solved += done
      total += exs.length
      const lesson = lessons.find((l) => l.chapter === chapter.id && l.topic === topic)
      if (lesson && !shown.has(lesson.id)) {
        shown.add(lesson.id)
        nodes.push({ key: `l-${lesson.id}`, kind: 'lesson', label: 'Genomgång', sub: lesson.title, href: lessonHref(lesson.id), state: lessonDone(lesson.id) ? 'done' : 'open' })
      }
      const isCurrent = exs.includes(featured)
      nodes.push({
        key: `s-${s.section}-${topic}`,
        kind: 'set',
        label: topic || sectionLabel(s),
        sub: `${done} av ${exs.length} klara`,
        href: isCurrent ? exerciseHref(featured.id) : `#/kapitel/${chapter.id}?avsnitt=${encodeURIComponent(s.section)}${topic ? `&omrade=${encodeURIComponent(topic)}` : ''}`,
        state: done === exs.length ? 'done' : isCurrent ? 'current' : done > 0 ? 'open' : 'later',
      })
    }
  }
  if (!nodes.length) return null
  if (redo.length) nodes.push({ key: 'redo', kind: 'redo', label: 'Repetition', sub: `${redo.length} att göra om`, onClick: () => startRedoSession(redo.map((e) => e.id)), state: 'open' })
  nodes.push({ key: 'trophy', kind: 'trophy', label: 'Kapitlet klart', sub: `${solved} av ${total} uppgifter`, href: `#/kapitel/${chapter.id}`, state: solved === total ? 'done' : 'later' })

  return (
    <section className="sg-unit" aria-label={chapter.title}>
      <div className="sg-unit-head">
        <div>
          <small>{chapter.label ?? `Kapitel ${chapter.id}`}</small>
          <h2>{chapter.title}</h2>
        </div>
        <a href={`#/kapitel/${chapter.id}`}>Hela kapitlet</a>
        <span className="sg-unit-bar" aria-hidden="true">
          <i style={{ width: `${total ? (100 * solved) / total : 0}%` }} />
        </span>
      </div>
      <ol className="sg-path">
        {nodes.map((n, i) => {
          const x = Math.round(Math.sin(i * 0.85) * 100)
          const inner = (
            <>
              {n.state === 'current' && <span className="sg-bubble">Starta</span>}
              {n.state === 'done' && n.kind === 'lesson' && (
                <span className="sg-done" aria-hidden="true">
                  <Check size={13} strokeWidth={3.5} />
                </span>
              )}
              <span className="sg-face">
                <NodeIcon node={n} />
              </span>
            </>
          )
          const cls = `sg-node k-${n.kind} s-${n.state}`
          const label = `${n.label}${n.sub ? `, ${n.sub}` : ''}`
          return (
            <li key={n.key} style={{ '--x': `${x}px` } as CSSProperties} className={`${x > 30 ? 'left' : ''} ${n.state === 'current' ? 'cur' : ''}`}>
              {n.href ? (
                <a className={cls} href={n.href} aria-label={label}>
                  {inner}
                </a>
              ) : (
                <button className={cls} onClick={n.onClick} aria-label={label}>
                  {inner}
                </button>
              )}
              <span className="sg-tag" aria-hidden="true">
                <b>{n.label}</b>
                {n.sub && <small>{n.sub}</small>}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function NodeIcon({ node }: { node: PathNode }) {
  if (node.kind === 'lesson') return <BookOpen size={30} />
  if (node.kind === 'redo') return <Undo size={30} />
  if (node.kind === 'trophy') return <Trophy size={30} />
  if (node.state === 'done') return <Check size={34} strokeWidth={3} />
  return <Star size={30} />
}

/** Kolumnen bredvid stigen: dagens uppdrag, topplistan och märken. */
function SideColumn({ exercises, onGoal }: { exercises: Exercise[]; onGoal: () => void }) {
  const game = useGame()
  const { dailyGoal, srs } = useSettings()
  const review = useSrsToday(exercises)
  const inbox = useInbox()
  const [board, setBoard] = useState<Friend[] | null>(null)
  useEffect(() => {
    if (inbox.joined) fetchBoard().then(setBoard, () => setBoard([]))
  }, [inbox.joined])
  if (!game) return <aside className="sg-side" />
  const due = review?.due.length ?? 0
  const quests: { key: string; icon: ReactNode; color: string; title: string; have: number; need: number; href?: string; onClick?: () => void }[] = [
    { key: 'goal', icon: <Bolt size={20} />, color: 'sun', title: dailyGoal > 0 ? `${dailyGoal} rätta svar idag` : 'Välj ett dagligt mål', have: game.today, need: Math.max(1, dailyGoal), onClick: onGoal },
    { key: 'srs', icon: <Undo size={20} />, color: 'sky', title: !srs.enabled ? 'Repetition avstängd' : due ? `Repetera ${due} ${due === 1 ? 'uppgift' : 'uppgifter'}` : 'Ingen repetition idag', have: due ? 0 : 1, need: 1, href: '#/ova' },
    { key: 'streak', icon: <Flame size={20} />, color: 'coral', title: game.streakDays ? `${game.streakDays} ${game.streakDays === 1 ? 'dag' : 'dagar'} i rad` : 'Räkna idag och starta en svit', have: game.today > 0 ? 1 : 0, need: 1, href: '#/statistik' },
  ]
  const sorted = [...(board ?? [])].sort((a, b) => (b.stats.weekXp ?? 0) - (a.stats.weekXp ?? 0)).slice(0, 4)
  const earned = game.badges.filter((b) => b.earned)
  const showBadges = [...earned, ...game.badges.filter((b) => !b.earned)].slice(0, 4)
  return (
    <aside className="sg-side">
      <div className="sg-box">
        <h3>Dagens uppdrag</h3>
        <div className="sg-quests">
          {quests.map((q) => {
            const inner = (
              <>
                <span className={`sg-qi c-${q.color}`}>{q.icon}</span>
                <b>{q.title}</b>
                <span className="sg-qbar">
                  <i style={{ width: `${Math.min(100, (100 * q.have) / q.need)}%` }} />
                </span>
              </>
            )
            return q.href ? (
              <a key={q.key} href={q.href}>
                {inner}
              </a>
            ) : (
              <button key={q.key} onClick={q.onClick}>
                {inner}
              </button>
            )
          })}
        </div>
      </div>

      <div className="sg-box">
        <h3>
          Veckans topplista <a href="#/kompisar">Visa</a>
        </h3>
        {inbox.joined === false ? (
          <p className="sg-muted">
            Gå med under <a href="#/kompisar">Kompisar</a> för att tävla mot dina vänner.
          </p>
        ) : !board ? (
          <p className="sg-muted">{inbox.error ? 'Kunde inte hämta topplistan just nu.' : 'Hämtar …'}</p>
        ) : !sorted.length ? (
          <p className="sg-muted">Lägg till kompisar så syns ni här.</p>
        ) : (
          <div className="sg-board">
            {sorted.map((f, i) => (
              <a key={f.user_id} href={`#/kompisar/${f.user_id}`} className={f.name === inbox.me?.name ? 'me' : ''}>
                <span className="pos">{i + 1}</span>
                <span className={`av c${i % 4}`}>{f.name.slice(0, 1).toUpperCase()}</span>
                <b>{f.name === inbox.me?.name ? 'Du' : f.name}</b>
                <span className="xp">{f.stats.weekXp ?? 0} XP</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="sg-box">
        <h3>
          Utmärkelser <a href="#/statistik">Alla {game.badges.length}</a>
        </h3>
        <div className="sg-badges">
          {showBadges.map((b, i) => (
            <span key={b.id} className={`sg-badge ${b.earned ? `c${i % 4}` : 'off'}`} title={`${b.title}: ${b.text}`}>
              {b.icon}
            </span>
          ))}
        </div>
        <p className="sg-muted">
          {earned.length} av {game.badges.length} tagna · nivå {game.level.level}, {game.level.name}
        </p>
      </div>
      <p className="sg-week">{weekSentence(game.week)}</p>
    </aside>
  )
}

export function Ring({ value, size = 34 }: { value: number; size?: number }) {
  const r = size / 2 - 3
  const c = 2 * Math.PI * r
  return (
    <svg className="mk-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="track" />
      <circle cx={size / 2} cy={size / 2} r={r} className="fill" strokeDasharray={`${c * value} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  )
}

function Row({ title, note, meta, href, variant, children }: { title: string; note?: string; meta?: ReactNode; href?: string; variant?: 'posters'; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const update = () => {
    const el = track.current
    if (el) setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 })
  }
  useEffect(update, [])
  const scroll = (dir: number) => track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' })
  return (
    <section className={`mk-row ${variant ?? ''}`}>
      <div className="mk-row-head">
        <h2>{href ? <a href={href}>{title}</a> : title}</h2>
        {meta}
        {note && <p className="mk-row-note">{note}</p>}
        {href && (
          <a className="mk-row-all" href={href}>
            Visa alla <ChevronRight size={15} />
          </a>
        )}
      </div>
      <div className="mk-row-body">
        {!edges.start && (
          <button className="mk-arrow left" onClick={() => scroll(-1)} aria-label="Bläddra bakåt">
            <ChevronLeft size={28} />
          </button>
        )}
        <div className="mk-track" ref={track} onScroll={update}>
          {children}
        </div>
        {!edges.end && (
          <button className="mk-arrow right" onClick={() => scroll(1)} aria-label="Bläddra framåt">
            <ChevronRight size={28} />
          </button>
        )}
      </div>
    </section>
  )
}

const STATUS_LABEL: Record<Status, string> = { new: 'Ny', attempted: 'Påbörjad', correct: 'Klar', missed: 'Missad' }

export function Tile({ ex, progress }: { ex: Exercise; progress: Progress }) {
  const p = progress.byExercise[ex.id]
  const saved = !!useBookmarks()[ex.id]
  const fig = [...(ex.figures ?? []), ...ex.parts.flatMap((p) => p.figures ?? [])].find((f) => f.kind !== 'table')
  return (
    <a className={`mk-tile st-${p.status} ${saved ? 'saved' : ''}`} href={exerciseHref(ex.id)} onClick={markTransition} aria-label={`Uppgift ${ex.number}${ex.level ? `, nivå ${ex.level}` : ''}, ${STATUS_LABEL[p.status]}${saved ? ', sparad till senare' : ''}`}>
      <div className="mk-tile-card">
        <div className="mk-tile-thumb" aria-hidden="true">
          <MathText text={ex.prompt || ex.parts[0].prompt || ''} />
          {fig && (
            <div className="mk-tile-fig">
              <Figure figure={fig} />
            </div>
          )}
        </div>
        <div className="mk-tile-shade" />
        {ex.level && <span className={`mk-lvl mk-lvl-${ex.level}`}>{ex.level.toUpperCase()}</span>}
        {p.status === 'correct' && (
          <span className="mk-badge ok">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        {p.status !== 'correct' && p.needsRedo && <span className="mk-badge miss">{p.wrong} fel</span>}
        {saved && (
          <span className="mk-saved" title="Sparad till senare">
            <Bookmark size={14} filled />
          </span>
        )}
        <span className="mk-tile-num" data-vt="num">
          {ex.number}
        </span>
        {(p.status === 'attempted' || (p.status === 'missed' && p.done > 0)) && (
          <span className="mk-tile-progress">
            <span style={{ width: `${Math.max(0.08, p.done) * 100}%` }} />
          </span>
        )}
        <div className="mk-tile-more">
          <span className="mk-tile-play">
            <Play size={14} />
          </span>
          <span>
            {ex.topic} · {ex.parts.length > 1 ? `${ex.parts.length} delar` : '1 del'}
          </span>
        </div>
      </div>
    </a>
  )
}
