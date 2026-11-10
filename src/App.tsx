import { lazy, Suspense, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Library } from './library/Library.tsx'
import { ChapterPage } from './library/ChapterPage.tsx'
import { StatsPage } from './library/StatsPage.tsx'
import { Login } from './vault/Login.tsx'
import { SubjectPicker } from './subject/SubjectPicker.tsx'
import { Celebrator } from './game/Celebrator.tsx'
import { StatsPublisher } from './social/StatsPublisher.tsx'
import { useReadability } from './settings/readability.ts'
import { restoreSession, useVaultStatus } from './vault/vault.ts'

// Uppgiftssidan (skrivyta, mattefält) och granskningen laddas först när de behövs.
const ExercisePage = lazy(() => import('./exercise/ExercisePage.tsx').then((m) => ({ default: m.ExercisePage })))
const LessonPage = lazy(() => import('./lessons/LessonPage.tsx').then((m) => ({ default: m.LessonPage })))
const LessonsIndex = lazy(() => import('./lessons/LessonsIndex.tsx').then((m) => ({ default: m.LessonsIndex })))
const PracticePage = lazy(() => import('./practice/PracticePage.tsx').then((m) => ({ default: m.PracticePage })))
const GeneratorPage = lazy(() => import('./practice/GeneratorPage.tsx').then((m) => ({ default: m.GeneratorPage })))
const FriendsPage = lazy(() => import('./social/FriendsPage.tsx').then((m) => ({ default: m.FriendsPage })))
const DuelPage = lazy(() => import('./social/DuelPage.tsx').then((m) => ({ default: m.DuelPage })))
const AdminPage = lazy(() => import('./admin/AdminPage.tsx').then((m) => ({ default: m.AdminPage })))
const FormulaPage = lazy(() => import('./formulas/FormulaPage.tsx').then((m) => ({ default: m.FormulaPage })))
const ReviewPage = lazy(() => import('./review/ReviewPage.tsx').then((m) => ({ default: m.ReviewPage })))
const loading = <div className="mk-loading">Laddar …</div>

restoreSession()

const routeOf = () => location.hash.replace(/^#\/?/, '').split('?')[0]

export function App() {
  useReadability()
  const vault = useVaultStatus()
  if (vault === 'checking') return loading
  if (vault === 'locked') return <Login />
  return (
    <>
      <Routes />
      <Celebrator />
      <StatsPublisher />
    </>
  )
}

function Routes() {
  const [route, setRoute] = useState(routeOf)
  useEffect(() => {
    const onHash = () => {
      const next = routeOf()
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
      // Mjuk övergång mellan sidor där webbläsaren stöder det.
      if (doc.startViewTransition && !calm) {
        // En övergång som avbryts (t.ex. vid snabba klick) är ofarlig.
        const t = doc.startViewTransition(() => flushSync(() => setRoute(next)))
        t.ready.catch(() => {})
        t.finished.catch(() => {})
      }
      else setRoute(next)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (route === 'granska')
    return (
      <Suspense fallback={loading}>
        <ReviewPage />
      </Suspense>
    )
  if (route.startsWith('uppgift/'))
    return (
      <Suspense fallback={loading}>
        <ExercisePage id={decodeURIComponent(route.slice('uppgift/'.length))} />
      </Suspense>
    )
  if (route === 'lar')
    return (
      <Suspense fallback={loading}>
        <LessonsIndex />
      </Suspense>
    )
  if (route.startsWith('lar/'))
    return (
      <Suspense fallback={loading}>
        <LessonPage key={route} id={decodeURIComponent(route.slice('lar/'.length))} />
      </Suspense>
    )
  if (route.startsWith('kapitel')) return <ChapterPage key={location.hash} chapterId={Number(route.split('/')[1] ?? 1) || 1} />
  if (route === 'statistik') return <StatsPage />
  if (route === 'ova')
    return (
      <Suspense fallback={loading}>
        <PracticePage />
      </Suspense>
    )
  if (route.startsWith('ova/nya/'))
    return (
      <Suspense fallback={loading}>
        <GeneratorPage key={route} id={decodeURIComponent(route.slice('ova/nya/'.length))} />
      </Suspense>
    )
  if (route === 'kompisar' || route.startsWith('kompisar/'))
    return (
      <Suspense fallback={loading}>
        <FriendsPage with={route.split('/')[1] || undefined} />
      </Suspense>
    )
  if (route.startsWith('duell/'))
    return (
      <Suspense fallback={loading}>
        <DuelPage key={route} id={route.slice('duell/'.length)} />
      </Suspense>
    )
  if (route === 'admin')
    return (
      <Suspense fallback={loading}>
        <AdminPage />
      </Suspense>
    )
  if (route === 'formler')
    return (
      <Suspense fallback={loading}>
        <FormulaPage />
      </Suspense>
    )
  if (route === 'hem') return <Library />
  return <SubjectPicker />
}
