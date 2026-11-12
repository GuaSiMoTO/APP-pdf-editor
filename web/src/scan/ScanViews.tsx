// Vistas del escáner (solo presentación; el estado y la lógica están en ScanPage).
import { Camera, Images, Plus, RotateCw, ScanLine, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { FitCanvas } from '../ui/FitCanvas'
import { NavBar } from '../ui/NavBar'
import { CropEditor } from './CropEditor'
import type { ScanFilter } from './detect'
import type { Quad } from './geometry'
import type { Draft, ScannedPage } from './scanTypes'

const FILTERS: { id: ScanFilter; label: string }[] = [
  { id: 'color', label: 'Color' },
  { id: 'gray', label: 'Grises' },
  { id: 'bw', label: 'Blanco y negro' },
]

/** Ajustar las esquinas del documento detectado. */
export function CropView({ draft, onQuad, onCancel, onNext, overlay }: {
  draft: Draft
  onQuad: (quad: Quad) => void
  onCancel: () => void
  onNext: () => void
  overlay?: ReactNode
}) {
  return (
    <div className="screen screen-fixed">
      <NavBar
        title="Ajustar bordes"
        back={{ onClick: onCancel, label: 'Cancelar' }}
        trailing={<button type="button" className="bar-button strong" onClick={onNext}>Siguiente</button>}
      />
      <div className="stage">
        <CropEditor source={draft.source} quad={draft.quad} onChange={onQuad} />
      </div>
      <footer className="toolbar">
        <div className="toolbar-inner hint">Arrastra las esquinas para ajustar el recorte</div>
      </footer>
      {overlay}
    </div>
  )
}

/** Elegir filtro y giro de la página enderezada. */
export function FilterView({ result, filter, onFilter, onRotate, onBack, onSave, overlay }: {
  result: HTMLCanvasElement
  filter: ScanFilter
  onFilter: (f: ScanFilter) => void
  onRotate: () => void
  onBack: () => void
  onSave: () => void
  overlay?: ReactNode
}) {
  return (
    <div className="screen screen-fixed">
      <NavBar
        title="Página"
        back={{ onClick: onBack, label: 'Recortar' }}
        trailing={<button type="button" className="bar-button strong" onClick={onSave}>Guardar</button>}
      />
      <div className="stage">
        <FitCanvas source={result} className="page-shadow" />
      </div>
      <footer className="toolbar">
        <div className="toolbar-inner">
          <div className="segmented" style={{ flex: 1 }}>
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => onFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <button type="button" className="icon-button" aria-label="Girar" onClick={onRotate}>
            <RotateCw size={22} />
          </button>
        </div>
      </footer>
      {overlay}
    </div>
  )
}

/** Lista de páginas escaneadas (o estado vacío si aún no hay ninguna). */
export function PagesView({ pages, name, onName, onEdit, onDelete, onCamera, onLibrary, onCreate, children }: {
  pages: ScannedPage[]
  name: string
  onName: (name: string) => void
  onEdit: (page: ScannedPage) => void
  onDelete: (page: ScannedPage) => void
  onCamera: () => void
  onLibrary: () => void
  onCreate: () => void
  /** Inputs ocultos y HUD. */
  children?: ReactNode
}) {
  return (
    <div className="screen screen-fixed">
      <NavBar title={pages.length ? 'Escaneo' : undefined} back={{ to: '/', label: 'Inicio' }} />
      {pages.length === 0 ? (
        <main className="content fade-in">
          <div className="empty">
            <div className="empty-icon" style={{ background: 'var(--c-blue)' }}>
              <ScanLine size={44} strokeWidth={1.8} />
            </div>
            <h2>Escanear documento</h2>
            <p>Haz una foto de cada página. Detectamos los bordes y la enderezamos automáticamente.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-block" onClick={onCamera}>
                <Camera size={20} /> Hacer foto
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={onLibrary}>
                <Images size={20} /> Elegir de Fotos
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          <main className="content scroll fade-in">
            <h2 className="section-header">Nombre</h2>
            <div className="list">
              <label className="row">
                <input className="text-field" value={name} onChange={(e) => onName(e.target.value)}
                  placeholder="Nombre del documento" enterKeyHint="done" />
              </label>
            </div>

            <h2 className="section-header">
              {pages.length} {pages.length === 1 ? 'página' : 'páginas'} · Toca una para editarla
            </h2>
            <div className="pages-grid">
              {pages.map((page, i) => (
                <div key={page.id} className="page-tile">
                  <button type="button" className="page-thumb" onClick={() => onEdit(page)}>
                    <img src={page.url} alt={`Página ${i + 1}`} />
                  </button>
                  <button type="button" className="page-delete" aria-label={`Eliminar página ${i + 1}`} onClick={() => onDelete(page)}>
                    <X size={14} strokeWidth={3} />
                  </button>
                  <span className="page-number">{i + 1}</span>
                </div>
              ))}
              <button type="button" className="page-add" onClick={onCamera} aria-label="Añadir página">
                <Plus size={28} />
              </button>
            </div>
          </main>
          <footer className="toolbar">
            <div className="toolbar-inner">
              <button type="button" className="icon-button" aria-label="Elegir de Fotos" onClick={onLibrary}>
                <Images size={22} />
              </button>
              <button type="button" className="icon-button" aria-label="Hacer foto" onClick={onCamera}>
                <Camera size={22} />
              </button>
              <button type="button" className="btn btn-primary" onClick={onCreate}>
                Crear PDF
              </button>
            </div>
          </footer>
        </>
      )}
      {children}
    </div>
  )
}
