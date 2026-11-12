import { Check } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import type { PdfDoc } from '../lib/pdfjs'
import { PageThumb } from './PageThumb'

interface Props extends HTMLAttributes<HTMLDivElement> {
  doc: PdfDoc
  index: number
  rotation?: number
  label: ReactNode
  /** undefined = no seleccionable; true/false muestra el círculo de selección (estilo Fotos). */
  selected?: boolean
  dragging?: boolean
  dimmed?: boolean
}

/** Miniatura de página para rejillas (organizar, dividir). */
export function PageTile({ doc, index, rotation, label, selected, dragging, dimmed, className, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={`tile${selected ? ' selected' : ''}${dragging ? ' dragging' : ''}${dimmed ? ' dimmed' : ''} ${className ?? ''}`}
    >
      <div className="tile-frame">
        <PageThumb doc={doc} index={index} rotation={rotation} />
        {selected !== undefined && (
          <span className="tile-check" aria-hidden="true">
            {selected && <Check size={14} strokeWidth={3.2} />}
          </span>
        )}
      </div>
      <span className="tile-label">{label}</span>
    </div>
  )
}
