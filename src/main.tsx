import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/nunito'
import '@fontsource-variable/source-serif-4'
import '@fontsource-variable/bricolage-grotesque'
import 'katex/dist/katex.min.css'
import './styles/base.css'
import './design/palettes.css'
import { App } from './App.tsx'
// Stigens utseende läggs efter appens egna stilar.
import './design/stigen.css'
import { applyTheme, loadTheme } from './design/theme.ts'

applyTheme(loadTheme())

// När en ny version av appen tar över (ny service worker) laddas sidan om, så att koden
// och den låsta boken alltid kommer från samma version. Inte vid allra första besöket.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  let reloaded = false
  const reload = () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Syns inte sidan just nu: ladda om direkt. Annars vid nästa sidbyte, när sidan göms
    // eller efter två minuter utan att någon rör den – så att ett svar man håller på att
    // skriva inte försvinner mitt i. (Ritningar och uträkningar sparas ändå automatiskt.)
    if (document.hidden) return reload()
    let idle = setTimeout(reload, 120_000)
    const active = () => {
      clearTimeout(idle)
      idle = setTimeout(reload, 120_000)
    }
    for (const ev of ['pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, active, { passive: true })
    window.addEventListener('hashchange', reload)
    document.addEventListener('visibilitychange', () => document.hidden && reload())
  })
  // Sidan byter aldrig adress på riktigt (allt sker efter #), så webbläsaren letar inte själv
  // efter en ny version. Fråga var femte minut och varje gång appen kommer tillbaka i fokus.
  navigator.serviceWorker.ready.then((reg) => {
    const check = () => void reg.update().catch(() => {})
    setInterval(check, 5 * 60_000)
    document.addEventListener('visibilitychange', () => !document.hidden && check())
    window.addEventListener('online', check)
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
