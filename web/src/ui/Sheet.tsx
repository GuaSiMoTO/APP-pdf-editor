import type { ReactNode } from 'react'

interface SheetProps {
  title: string
  onClose: () => void
  trailing?: ReactNode
  children: ReactNode
}

/** Hoja inferior estilo iOS (con tirador y fondo oscurecido). */
export function Sheet({ title, onClose, trailing, children }: SheetProps) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        <div className="sheet-header">
          <button type="button" className="bar-button" onClick={onClose}>Cerrar</button>
          <div className="navbar-title">{title}</div>
          <div className="navbar-side end">{trailing}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}
