// Anotaciones sobre páginas (texto, fecha, ✓/✗, resaltado, tapado, dibujo).
// Coordenadas en puntos PDF "vistos" (origen arriba-izquierda, y hacia abajo); ver pageGeometry.ts.
// La geometría (líneas base, trazos de ✓/✗, cajas) la comparten la vista SVG y el PDF final.
import { BlendMode, degrees, LineCapStyle, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { viewOf } from './pageGeometry'

type Pt = [number, number]

interface Base {
  id: string
  page: number
  color: string // #rrggbb
}
export interface TextAnnot extends Base { kind: 'text'; x: number; y: number; text: string; size: number }
export interface RectAnnot extends Base { kind: 'rect'; x: number; y: number; w: number; h: number; style: 'highlight' | 'cover' }
export interface MarkAnnot extends Base { kind: 'mark'; x: number; y: number; s: number; symbol: 'check' | 'cross' }
export interface InkAnnot extends Base { kind: 'ink'; points: Pt[]; width: number }
export type Annot = TextAnnot | RectAnnot | MarkAnnot | InkAnnot

export const LINE_HEIGHT = 1.2
/** Distancia de la parte superior de la caja a la primera línea base (en em). */
export const FIRST_BASELINE = 0.9
export const HIGHLIGHT_OPACITY = 0.4

export function textLines(a: TextAnnot): string[] {
  return a.text.split('\n')
}

/** Línea base de cada línea de texto. */
export function textBaselines(a: TextAnnot): Pt[] {
  return textLines(a).map((_, i) => [a.x, a.y + a.size * (FIRST_BASELINE + i * LINE_HEIGHT)])
}

/** Trazos (polilíneas) de ✓ / ✗ dentro de su caja cuadrada. */
export function markStrokes(a: MarkAnnot): Pt[][] {
  const p = (u: number, v: number): Pt => [a.x + u * a.s, a.y + v * a.s]
  return a.symbol === 'check'
    ? [[p(0.1, 0.55), p(0.38, 0.85), p(0.92, 0.15)]]
    : [[p(0.15, 0.15), p(0.85, 0.85)], [p(0.85, 0.15), p(0.15, 0.85)]]
}
export const markWidth = (a: MarkAnnot) => a.s * 0.13

// Medición de texto aproximada (Helvetica ≈ Arial) para la caja de selección
let measureCtx: CanvasRenderingContext2D | null = null
export function measureText(text: string, size: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx!.font = `${size}px Helvetica, Arial, sans-serif`
  return measureCtx!.measureText(text).width
}

/** Caja que ocupa la anotación (para selección, mover y redimensionar). */
export function bounds(a: Annot): { x: number; y: number; w: number; h: number } {
  switch (a.kind) {
    case 'text': {
      const lines = textLines(a)
      const w = Math.max(...lines.map((l) => measureText(l || ' ', a.size)))
      return { x: a.x, y: a.y, w, h: a.size * (FIRST_BASELINE + 0.3 + (lines.length - 1) * LINE_HEIGHT) }
    }
    case 'rect': return { x: a.x, y: a.y, w: a.w, h: a.h }
    case 'mark': return { x: a.x, y: a.y, w: a.s, h: a.s }
    case 'ink': {
      const xs = a.points.map((p) => p[0])
      const ys = a.points.map((p) => p[1])
      const pad = a.width / 2
      return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + a.width, h: Math.max(...ys) - Math.min(...ys) + a.width }
    }
  }
}

/** Desplaza una anotación (dx, dy) en puntos vistos. */
export function moved<T extends Annot>(a: T, dx: number, dy: number): T {
  if (a.kind === 'ink') return { ...a, points: a.points.map(([x, y]) => [x + dx, y + dy] as Pt) }
  return { ...a, x: a.x + dx, y: a.y + dy }
}

/** Cambia el tamaño arrastrando la esquina inferior derecha hasta (w, h). */
export function resized<T extends Annot>(a: T, w: number, h: number): T {
  switch (a.kind) {
    case 'rect': return { ...a, w: Math.max(4, w), h: Math.max(4, h) }
    case 'mark': return { ...a, s: Math.max(6, Math.min(w, h)) }
    case 'text': {
      const b = bounds(a)
      return { ...a, size: Math.max(5, Math.min(96, a.size * (h / b.h))) }
    }
    default: return a
  }
}

// ---------- Aplicar al PDF ----------

function hex(c: string) {
  const n = parseInt(c.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function applyAnnotations(bytes: ArrayBuffer, annots: Annot[]): Promise<Blob> {
  const pdf = await PDFDocument.load(bytes)
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  for (const a of annots) {
    const page = pdf.getPage(a.page)
    const view = viewOf(page)
    const color = hex(a.color)
    const rotate = degrees(view.rotation)

    const polyline = (pts: Pt[], thickness: number) => {
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = view.toUser(...pts[i - 1])
        const [x2, y2] = view.toUser(...pts[i])
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color, lineCap: LineCapStyle.Round })
      }
      if (pts.length === 1) {
        const [x, y] = view.toUser(...pts[0])
        page.drawCircle({ x, y, size: thickness / 2, color })
      }
    }

    switch (a.kind) {
      case 'text': {
        const lines = textLines(a)
        textBaselines(a).forEach(([vx, vy], i) => {
          if (!lines[i]) return
          const [x, y] = view.toUser(vx, vy)
          try {
            page.drawText(lines[i], { x, y, size: a.size, font, color, rotate })
          } catch {
            throw new Error(`El texto «${lines[i]}» contiene caracteres no admitidos (p. ej. emojis).`)
          }
        })
        break
      }
      case 'rect': {
        // Esquina inferior-izquierda vista → espacio PDF, girando igual que la página
        const [x, y] = view.toUser(a.x, a.y + a.h)
        page.drawRectangle({
          x, y, width: a.w, height: a.h, rotate, color,
          ...(a.style === 'highlight' ? { opacity: HIGHLIGHT_OPACITY, blendMode: BlendMode.Multiply } : {}),
        })
        break
      }
      case 'mark':
        markStrokes(a).forEach((s) => polyline(s, markWidth(a)))
        break
      case 'ink':
        polyline(a.points, a.width)
        break
    }
  }

  const out = await pdf.save()
  return new Blob([out.slice().buffer], { type: 'application/pdf' })
}
