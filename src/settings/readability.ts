// Läsbarhet: större text och ett lättläst typsnitt. Sätts som attribut på <html> så att
// stilmallarna kan anpassa sig.
import { useEffect } from 'react'
import { useSettings } from './settings.ts'

let fontLoaded = false

export function useReadability() {
  const { textSize, easyFont } = useSettings()
  useEffect(() => {
    const root = document.documentElement
    if (textSize === 'm') delete root.dataset.text
    else root.dataset.text = textSize
    if (easyFont) {
      root.dataset.font = 'easy'
      // Typsnittet hämtas först när det behövs.
      if (!fontLoaded) {
        fontLoaded = true
        void import('@fontsource/atkinson-hyperlegible/400.css')
        void import('@fontsource/atkinson-hyperlegible/700.css')
        void import('@fontsource/atkinson-hyperlegible/400-italic.css')
      }
    } else delete root.dataset.font
  }, [textSize, easyFont])
}
