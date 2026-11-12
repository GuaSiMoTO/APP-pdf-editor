import { X } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import type { PdfDoc } from '../lib/pdfjs'
import { PageStatus } from '../ui/PageStatus'
import { usePageCanvas } from '../ui/usePageCanvas'
import { setScrollLocked } from '../ui/scrollLock'
import type { Placement } from './stamp'

const MIN_NW = 0.08

interface Props {
  doc: PdfDoc
  index: number
  width: number // ancho CSS
  aspect: number // alto / ancho de la página
  placements: Placement[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onChange: (p: Placement) => void
  onDelete: (id: string) => void
}

/** Página del PDF (renderizada al hacerse visible) con las firmas colocadas encima. */
export function PageView({ doc, index, width, aspect, placements, selectedId, onSelect, onChange, onDelete }: Props) {
  const { wrapRef: ref, canvasRef, status } = usePageCanvas(doc, index, width)
  const height = width * aspect

  // Arrastre (mover o redimensionar) de una firma
  const drag = useRef<{ id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: Placement } | null>(null)

  const startDrag = (e: PointerEvent, p: Placement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = { id: p.id, mode, startX: e.clientX, startY: e.clientY, orig: p }
    setScrollLocked(true)
    onSelect(p.id)
  }

  const moveDrag = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.startX) / width
    const dy = (e.clientY - d.startY) / height
    const o = d.orig
    const nh = (nw: number) => (nw * o.aspect * width) / height
    if (d.mode === 'move') {
      onChange({
        ...o,
        nx: Math.min(1 - o.nw, Math.max(0, o.nx + dx)),
        ny: Math.min(1 - nh(o.nw), Math.max(0, o.ny + dy)),
      })
    } else {
      // Mantiene la proporción; limita para que no se salga de la página
      const maxW = Math.min(1 - o.nx, ((1 - o.ny) * height) / (o.aspect * width))
      onChange({ ...o, nw: Math.min(maxW, Math.max(MIN_NW, o.nw + dx)) })
    }
  }

  const endDrag = () => {
    drag.current = null
    setScrollLocked(false)
  }

  return (
    <div ref={ref} className="pdf-page" style={{ width, height }} data-page={index}
      onPointerDown={() => onSelect(null)}>
      <canvas ref={canvasRef} style={{ width, height }} />
      <PageStatus status={status} />
      {placements.map((p) => {
        const selected = p.id === selectedId
        return (
          <div
            key={p.id}
            className={`placement${selected ? ' selected' : ''}`}
            style={{ left: p.nx * width, top: p.ny * height, width: p.nw * width, height: p.nw * width * p.aspect }}
            onPointerDown={(e) => startDrag(e, p, 'move')}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <img src={p.dataUrl} alt="Firma" draggable={false} />
            {selected && (
              <>
                <button type="button" className="placement-delete" aria-label="Quitar firma"
                  onPointerDown={(e) => e.stopPropagation()} onClick={() => onDelete(p.id)}>
                  <X size={14} strokeWidth={3} />
                </button>
                <span
                  className="placement-resize"
                  aria-label="Cambiar tamaño"
                  onPointerDown={(e) => startDrag(e, p, 'resize')}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
