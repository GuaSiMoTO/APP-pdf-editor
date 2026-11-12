import { useRef, useState, type PointerEvent } from 'react'
import { bounds, type Annot, type TextAnnot } from '../lib/annotations'
import type { PdfDoc } from '../lib/pdfjs'
import { PageStatus } from '../ui/PageStatus'
import { setScrollLocked } from '../ui/scrollLock'
import { usePageCanvas } from '../ui/usePageCanvas'
import { AnnotShape, HitBox, SelectionFrame } from './AnnotShape'
import {
  DRAG_THRESHOLD_PX, dragged, extendDraft, isDrawingTool, keepDraft, newDraft, pillTop, placeAt,
  type Point, type Tool, type ToolStyle,
} from './gestures'

interface Props {
  doc: PdfDoc
  index: number
  W: number
  H: number
  cssWidth: number
  annots: Annot[]
  selectedId: string | null
  tool: Tool
  style: ToolStyle
  onSelect: (id: string | null) => void
  /** Antes de modificar una anotación existente (para deshacer). */
  onBegin: () => void
  onChange: (a: Annot) => void
  onCreate: (a: Annot) => void
  onPlaceText: (page: number, x: number, y: number) => void
  onEdit: (a: TextAnnot) => void
  onDelete: (id: string) => void
}

/** Un toque que se desplaza más que esto (px) es un scroll, no un toque. */
const TAP_DISTANCE = 8

type Gesture =
  | { type: 'move' | 'resize'; start: Point; orig: Annot; begun: boolean }
  | { type: 'draw'; start: Point }
  | { type: 'tap'; client: Point }

/** Página con anotaciones: traduce los gestos del puntero (la lógica está en gestures.ts) y las dibuja. */
export function AnnotPage(props: Props) {
  const { doc, index, W, H, cssWidth, annots, selectedId, tool, style } = props
  const k = cssWidth / W // px por punto
  const cssHeight = H * k
  const { wrapRef, canvasRef, status } = usePageCanvas(doc, index, cssWidth)
  const [draft, setDraft] = useState<Annot | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const drawing = isDrawingTool(tool)

  const toView = (e: PointerEvent): Point => {
    const r = wrapRef.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(W, (e.clientX - r.left) / k)), Math.max(0, Math.min(H, (e.clientY - r.top) / k))]
  }

  /** Gesto que empieza en el modo "Mover", o null si se ha tocado fuera de todo. */
  const selectGesture = (target: Element, p: Point): Gesture | null => {
    const sel = annots.find((a) => a.id === selectedId)
    if (sel && target.closest('[data-handle]')) return { type: 'resize', start: p, orig: sel, begun: false }
    const hitId = target.closest<SVGGElement>('[data-id]')?.dataset.id
    const hit = annots.find((a) => a.id === hitId)
    if (!hit) return null
    props.onSelect(hit.id)
    return { type: 'move', start: p, orig: hit, begun: false }
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = toView(e)
    if (!drawing && tool !== 'select') {
      // Herramientas de colocar: con un toque y sin bloquear el scroll
      gesture.current = { type: 'tap', client: [e.clientX, e.clientY] }
      return
    }
    if (drawing) {
      gesture.current = { type: 'draw', start: p }
      setDraft(newDraft(tool, p, index, style, crypto.randomUUID()))
    } else {
      gesture.current = selectGesture(e.target as Element, p)
      if (!gesture.current) {
        props.onSelect(null)
        return
      }
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrollLocked(true)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.type === 'tap') return
    const p = toView(e)
    if (g.type === 'draw') {
      setDraft((d) => (d ? extendDraft(d, g.start, p, k) : d))
      return
    }
    const dx = p[0] - g.start[0]
    const dy = p[1] - g.start[1]
    if (!g.begun) {
      if (Math.hypot(dx, dy) * k < DRAG_THRESHOLD_PX) return
      g.begun = true
      props.onBegin()
    }
    props.onChange(dragged(g.type, g.orig, dx, dy, W, H))
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    gesture.current = null
    setScrollLocked(false)
    if (g?.type === 'tap') {
      if (Math.hypot(e.clientX - g.client[0], e.clientY - g.client[1]) <= TAP_DISTANCE) place(toView(e))
    } else if (g?.type === 'draw' && draft) {
      setDraft(null)
      if (keepDraft(draft, k)) props.onCreate(draft)
    }
  }

  const onPointerCancel = () => {
    gesture.current = null
    setDraft(null)
    setScrollLocked(false)
  }

  const place = (p: Point) => {
    const result = placeAt(tool, p, index, W, style, crypto.randomUUID(), new Date())
    if (result?.type === 'ask-text') props.onPlaceText(index, result.x, result.y)
    else if (result?.type === 'create') props.onCreate(result.annot)
  }

  const selected = tool === 'select' ? annots.find((a) => a.id === selectedId) : undefined
  const sb = selected ? bounds(selected) : null

  return (
    <div ref={wrapRef} className={`annot-page${drawing ? ' drawing' : ''}`}
      style={{ width: cssWidth, height: cssHeight }} data-page={index}>
      <canvas ref={canvasRef} style={{ width: cssWidth, height: cssHeight }} />
      <PageStatus status={status} />
      <svg viewBox={`0 0 ${W} ${H}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
        {annots.map((a) => (
          <g key={a.id} data-id={a.id} className={tool === 'select' ? 'hit' : undefined}>
            <AnnotShape a={a} />
            {tool === 'select' && <HitBox a={a} pad={8 / k} />}
          </g>
        ))}
        {draft && <AnnotShape a={draft} />}
        {selected && <SelectionFrame a={selected} k={k} />}
      </svg>
      {selected && sb && (
        <div className="annot-pill" style={{ left: (sb.x + sb.w / 2) * k, top: pillTop(sb, k) }}
          onPointerDown={(e) => e.stopPropagation()}>
          {selected.kind === 'text' && <button type="button" onClick={() => props.onEdit(selected)}>Editar</button>}
          <button type="button" className="destructive" onClick={() => props.onDelete(selected.id)}>Eliminar</button>
        </div>
      )}
    </div>
  )
}
