import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/** Si una pantalla falla al dibujarse, muestra un aviso en vez de dejar la app en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de interfaz', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="screen">
        <main className="content">
          <div className="empty">
            <h2>Algo ha fallado</h2>
            <p>Esta pantalla no se ha podido mostrar. Tus archivos no se han modificado.</p>
            <div className="actions">
              {/* Recarga completa: limpia cualquier estado que haya quedado a medias */}
              <button type="button" className="btn btn-primary btn-block" onClick={() => window.location.assign('/')}>
                Volver al inicio
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }
}
