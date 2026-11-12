import type { PageCanvasStatus } from './usePageCanvas'

/** Indicador sobre una página: cargando (mientras no está lista) o error. */
export function PageStatus({ status }: { status: PageCanvasStatus }) {
  if (status === 'ready') return null
  return (
    <div className="page-status" role={status === 'error' ? 'alert' : undefined}>
      {status === 'error' ? 'No se pudo mostrar esta página' : <div className="spinner" />}
    </div>
  )
}
