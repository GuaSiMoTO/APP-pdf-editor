// Lógica pura de los gestos del editor de anotaciones (sin DOM ni React).
// Coordenadas en puntos vistos de la página; `k` = píxeles de pantalla por punto.
import { bounds, moved, resized, type Annot, type RectAnnot } from '../lib/annotations'

export type Tool = 'select' | 'text' | 'date' | 'check' | 'cross' | 'highlight' | 'cover' | 'pen'

export interface ToolStyle {
  color: string
  textSize: number
  penWidth: number
  highlightColor: string
}

export type Point = [number, number]

/** Herramientas que dibujan arrastrando (bloquean el scroll mientras están activas). */
const DRAWING_TOOLS: readonly Tool[] = ['highlight', 'cover', 'pen']
export const isDrawingTool = (tool: Tool) => DRAWING_TOOLS.includes(tool)

/** Un rectángulo más pequeño que esto (en px de pantalla) se considera un toque accidental. */
const MIN_RECT_PX = 6
/** Distancia mínima (px de pantalla) entre puntos de un trazo. */
const MIN_INK_STEP_PX = 2
/** Movimiento (px de pantalla) a partir del cual empieza a moverse o redimensionarse. */
export const DRAG_THRESHOLD_PX = 3
/** Tamaño de ✓/✗ en una página A4; se escala con el ancho de la página. */
const MARK_SIZE_A4 = 16
/** El texto se coloca con su primera línea a la altura del dedo. */
const TEXT_OFFSET_EM = 0.6

/** Borrador que empieza a dibujarse en `p` con la herramienta indicada. */
export function newDraft(tool: Tool, p: Point, page: number, style: ToolStyle, id: string): Annot {
  if (tool === 'pen') return { id, page, kind: 'ink', points: [p], width: style.penWidth, color: style.color }
  const cover = tool === 'cover'
  return { id, page, kind: 'rect', x: p[0], y: p[1], w: 0, h: 0, style: cover ? 'cover' : 'highlight', color: cover ? '#ffffff' : style.highlightColor }
}

/** Extiende el borrador hasta `p` (trazo: añade punto; rectángulo: de `start` a `p`). */
export function extendDraft(d: Annot, start: Point, p: Point, k: number): Annot {
  if (d.kind === 'ink') {
    const last = d.points[d.points.length - 1]
    return Math.hypot(p[0] - last[0], p[1] - last[1]) * k < MIN_INK_STEP_PX ? d : { ...d, points: [...d.points, p] }
  }
  const r = d as RectAnnot
  return { ...r, x: Math.min(start[0], p[0]), y: Math.min(start[1], p[1]), w: Math.abs(p[0] - start[0]), h: Math.abs(p[1] - start[1]) }
}

/** ¿Se conserva el borrador al soltar? (los rectángulos diminutos son toques accidentales) */
export function keepDraft(d: Annot, k: number): boolean {
  if (d.kind !== 'rect') return true
  return d.w * k > MIN_RECT_PX && d.h * k > MIN_RECT_PX
}

/** Resultado de arrastrar `orig` (dx, dy) puntos. Al mover, no deja que salga de la página. */
export function dragged(mode: 'move' | 'resize', orig: Annot, dx: number, dy: number, W: number, H: number): Annot {
  const b = bounds(orig)
  if (mode === 'resize') return resized(orig, b.w + dx, b.h + dy)
  const cx = Math.max(-b.x, Math.min(W - b.x - b.w, dx))
  const cy = Math.max(-b.y, Math.min(H - b.y - b.h, dy))
  return moved(orig, cx, cy)
}

export type Placement =
  | { type: 'ask-text'; x: number; y: number } // abrir el editor de texto
  | { type: 'create'; annot: Annot }

/** Qué ocurre al tocar la página en (x, y) con una herramienta de colocar. */
export function placeAt(tool: Tool, [x, y]: Point, page: number, W: number, style: ToolStyle, id: string, now: Date): Placement | null {
  const textY = y - style.textSize * TEXT_OFFSET_EM
  switch (tool) {
    case 'text':
      return { type: 'ask-text', x, y: textY }
    case 'date': {
      const text = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      return { type: 'create', annot: { id, page, kind: 'text', x, y: textY, text, size: style.textSize, color: style.color } }
    }
    case 'check':
    case 'cross': {
      const s = (MARK_SIZE_A4 * W) / 595
      return { type: 'create', annot: { id, page, kind: 'mark', x: x - s / 2, y: y - s / 2, s, symbol: tool, color: style.color } }
    }
    default:
      return null
  }
}

/** Posición vertical (px) del menú Editar/Eliminar: encima de la selección si cabe, si no debajo. */
export function pillTop(b: { y: number; h: number }, k: number): number {
  return b.y * k > 52 ? b.y * k - 46 : (b.y + b.h) * k + 10
}
