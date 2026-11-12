import { useRef, useState, type PointerEvent } from 'react'
import {
  bounds, HIGHLIGHT_OPACITY, markStrokes, markWidth, moved, resized, textBaselines, textLines,
  type Annot, type InkAnnot, type RectAnnot, type TextAnnot,
} from '../lib/annotations'
import type { PdfDoc } from '../lib/pdfjs'
import { PageStatus } from '../ui/PageStatus'
import { setScrollLocked } from '../ui/scrollLock'
import { usePageCanvas } from '../ui/usePageCanvas'

export type Tool = 'select' | 'text' | 'date' | 'check' | 'cross' | 'highlight' | 'cover' | 'pen'

export interface ToolStyle {
  color: string
  textSize: number
  penWidth: number
  highlightColor: string
}

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

const DRAWING: Tool[] = ['highlight', 'cover', 'pen']
const TAP_DISTANCE = 8

type Gesture =
  | { type: 'move' | 'resize'; start: [number, number]; orig: Annot; begun: boolean }
  | { type: 'draw'; start: [number, number] }
  | { type: 'tap'; client: [number, number] }

/** Página con anotaciones: muestra, selecciona, mueve, redimensiona y crea. */
export function AnnotPage(props: Props) {
  const { doc, index, W, H, cssWidth, annots, selectedId, tool, style } = props
  const k = cssWidth / W // px por punto
  const cssHeight = H * k
  const { wrapRef, canvasRef, status } = usePageCanvas(doc, index, cssWidth)
  const [draft, setDraft] = useState<Annot | null>(null)
  const gesture = useRef<Gesture | null>(null)

  const toView = (e: PointerEvent): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect()
    return [Math.max(0, Math.min(W, (e.clientX - r.left) / k)), Math.max(0, Math.min(H, (e.clientY - r.top) / k))]
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = toView(e)
    const target = e.target as Element
    if (tool === 'select') {
      const sel = annots.find((a) => a.id === selectedId)
      const handle = target.closest('[data-handle]')
      const hit = target.closest<SVGGElement>('[data-id]')
      if (handle && sel) gesture.current = { type: 'resize', start: p, orig: sel, begun: false }
      else if (hit) {
        const a = annots.find((x) => x.id === hit.dataset.id)!
        props.onSelect(a.id)
        gesture.current = { type: 'move', start: p, orig: a, begun: false }
      } else {
        props.onSelect(null)
        return
      }
    } else if (DRAWING.includes(tool)) {
      gesture.current = { type: 'draw', start: p }
      const base = { id: crypto.randomUUID(), page: index }
      setDraft(tool === 'pen'
        ? { ...base, kind: 'ink', points: [p], width: style.penWidth, color: style.color }
        : { ...base, kind: 'rect', x: p[0], y: p[1], w: 0, h: 0, style: tool === 'cover' ? 'cover' : 'highlight',
            color: tool === 'cover' ? '#ffffff' : style.highlightColor })
    } else {
      // Herramientas de colocar: se colocan con un toque (sin bloquear el scroll)
      gesture.current = { type: 'tap', client: [e.clientX, e.clientY] }
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setScrollLocked(true)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g || g.type === 'tap') return
    const p = toView(e)
    if (g.type === 'draw') {
      setDraft((d) => {
        if (!d) return d
        if (d.kind === 'ink') {
          const last = d.points[d.points.length - 1]
          return Math.hypot(p[0] - last[0], p[1] - last[1]) * k < 2 ? d : { ...d, points: [...d.points, p] }
        }
        const r = d as RectAnnot
        return { ...r, x: Math.min(g.start[0], p[0]), y: Math.min(g.start[1], p[1]), w: Math.abs(p[0] - g.start[0]), h: Math.abs(p[1] - g.start[1]) }
      })
      return
    }
    const dx = p[0] - g.start[0]
    const dy = p[1] - g.start[1]
    if (!g.begun) {
      if (Math.hypot(dx, dy) * k < 3) return
      g.begun = true
      props.onBegin()
    }
    if (g.type === 'move') {
      const b = bounds(g.orig)
      // Que no se salga de la página
      const cx = Math.max(-b.x, Math.min(W - b.x - b.w, dx))
      const cy = Math.max(-b.y, Math.min(H - b.y - b.h, dy))
      props.onChange(moved(g.orig, cx, cy))
    } else {
      const b = bounds(g.orig)
      props.onChange(resized(g.orig, b.w + dx, b.h + dy))
    }
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    gesture.current = null
    setScrollLocked(false)
    if (!g) return
    if (g.type === 'tap') {
      if (Math.hypot(e.clientX - g.client[0], e.clientY - g.client[1]) > TAP_DISTANCE) return
      place(toView(e))
    } else if (g.type === 'draw' && draft) {
      setDraft(null)
      const ok = draft.kind === 'ink' ? true : (draft as RectAnnot).w * k > 6 && (draft as RectAnnot).h * k > 6
      if (ok) props.onCreate(draft)
    }
  }

  const onPointerCancel = () => {
    gesture.current = null
    setDraft(null)
    setScrollLocked(false)
  }

  const place = ([x, y]: [number, number]) => {
    const base = { id: crypto.randomUUID(), page: index, color: style.color }
    const scale = W / 595
    if (tool === 'text') props.onPlaceText(index, x, y - style.textSize * 0.6)
    else if (tool === 'date') {
      const text = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      props.onCreate({ ...base, kind: 'text', x, y: y - style.textSize * 0.6, text, size: style.textSize })
    } else if (tool === 'check' || tool === 'cross') {
      const s = 16 * scale
      props.onCreate({ ...base, kind: 'mark', x: x - s / 2, y: y - s / 2, s, symbol: tool })
    }
  }

  const selected = annots.find((a) => a.id === selectedId)
  const sb = selected ? bounds(selected) : null
  const pillTop = sb ? (sb.y * k > 52 ? sb.y * k - 46 : (sb.y + sb.h) * k + 10) : 0

  return (
    <div ref={wrapRef} className={`annot-page${DRAWING.includes(tool) ? ' drawing' : ''}`}
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
        {sb && selected && tool === 'select' && (
          <g className="selection">
            <rect x={sb.x - 3 / k} y={sb.y - 3 / k} width={sb.w + 6 / k} height={sb.h + 6 / k}
              fill="none" stroke="var(--tint)" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
            {selected.kind !== 'ink' && (
              <g data-handle>
                <circle cx={sb.x + sb.w + 3 / k} cy={sb.y + sb.h + 3 / k} r={20 / k} fill="transparent" />
                <circle cx={sb.x + sb.w + 3 / k} cy={sb.y + sb.h + 3 / k} r={8 / k} fill="#fff"
                  stroke="var(--tint)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </g>
        )}
      </svg>
      {sb && selected && tool === 'select' && (
        <div className="annot-pill" style={{ left: (sb.x + sb.w / 2) * k, top: pillTop }}
          onPointerDown={(e) => e.stopPropagation()}>
          {selected.kind === 'text' && <button type="button" onClick={() => props.onEdit(selected)}>Editar</button>}
          <button type="button" className="destructive" onClick={() => props.onDelete(selected.id)}>Eliminar</button>
        </div>
      )}
    </div>
  )
}

/** Dibujo SVG de una anotación (misma geometría que el PDF). */
export function AnnotShape({ a }: { a: Annot }) {
  switch (a.kind) {
    case 'text': {
      const lines = textLines(a)
      return (
        <text fontSize={a.size} fill={a.color} fontFamily="Helvetica, Arial, sans-serif" style={{ whiteSpace: 'pre' }}>
          {textBaselines(a).map(([x, y], i) => <tspan key={i} x={x} y={y}>{lines[i]}</tspan>)}
        </text>
      )
    }
    case 'rect':
      return a.style === 'highlight'
        ? <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} fillOpacity={HIGHLIGHT_OPACITY} style={{ mixBlendMode: 'multiply' }} />
        : <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} stroke="rgba(0,0,0,0.12)" strokeWidth={0.5} />
    case 'mark':
      return (
        <g fill="none" stroke={a.color} strokeWidth={markWidth(a)} strokeLinecap="round" strokeLinejoin="round">
          {markStrokes(a).map((s, i) => <polyline key={i} points={s.map((p) => p.join(',')).join(' ')} />)}
        </g>
      )
    case 'ink':
      return <InkShape a={a} />
  }
}

function InkShape({ a }: { a: InkAnnot }) {
  if (a.points.length === 1) return <circle cx={a.points[0][0]} cy={a.points[0][1]} r={a.width / 2} fill={a.color} />
  return <polyline points={a.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={a.color}
    strokeWidth={a.width} strokeLinecap="round" strokeLinejoin="round" />
}

/** Área táctil invisible algo mayor que la anotación. */
function HitBox({ a, pad }: { a: Annot; pad: number }) {
  const b = bounds(a)
  return <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} fill="transparent" />
}
