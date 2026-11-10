// Meddelandet till alla (från admin), överst på startsidan tills du stänger det.
import { useEffect, useState } from 'react'
import { fetchAnnouncement, type Announcement } from './api.ts'
import './admin.css'

const KEY = 'grinda.announcement.closed'

export function AnnouncementBanner() {
  const [a, setA] = useState<Announcement | null>(null)
  const [closed, setClosed] = useState(() => {
    try {
      return Number(localStorage.getItem(KEY) ?? 0)
    } catch {
      return 0
    }
  })
  useEffect(() => {
    fetchAnnouncement().then(setA, () => {})
  }, [])
  if (!a || closed === a.id) return null
  return (
    <div className="ad-banner" role="status">
      <span aria-hidden="true">📣</span>
      <p>{a.body}</p>
      <button
        onClick={() => {
          setClosed(a.id)
          try {
            localStorage.setItem(KEY, String(a.id))
          } catch {
            /* visas igen nästa gång */
          }
        }}
        aria-label="Stäng meddelandet"
      >
        ×
      </button>
    </div>
  )
}
