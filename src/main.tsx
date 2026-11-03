import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker } from './lib/push'
import './styles.css'

// Demande au navigateur de ne jamais effacer les données de l'app (dont la session),
// même quand l'iPhone manque de place. Sans effet là où ce n'est pas pris en charge.
try {
  navigator.storage?.persist?.().catch(() => undefined)
} catch {
  /* rien */
}

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
