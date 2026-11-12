import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ErrorBoundary } from './ui/ErrorBoundary'
import './index.css'

// Último recurso: que ningún fallo asíncrono pase sin dejar rastro.
// (Los esperados se gestionan donde ocurren; ver ui/useTask.ts.)
window.addEventListener('unhandledrejection', (e) => console.error('Promesa rechazada sin gestionar', e.reason))
window.addEventListener('error', (e) => console.error('Error no capturado', e.error ?? e.message))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
