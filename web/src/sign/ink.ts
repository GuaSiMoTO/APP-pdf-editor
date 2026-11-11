// Trazo de tinta suavizado (curvas cuadráticas entre puntos medios) con grosor variable:
// más fino cuanto más rápido se mueve el dedo, como un bolígrafo. Con Apple Pencil usa la presión.

export interface InkPoint {
  x: number
  y: number
  w: number // grosor en px CSS
}

export interface Stroke {
  color: string
  points: InkPoint[]
}

export const MIN_WIDTH = 1.4
export const MAX_WIDTH = 4.2

/** Calcula el grosor del nuevo punto a partir de la velocidad (px/ms) o la presión. */
export function nextWidth(prevWidth: number, velocity: number, pressure?: number): number {
  const target =
    pressure !== undefined && pressure > 0
      ? MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * pressure
      : Math.max(MIN_WIDTH, MAX_WIDTH - velocity * 1.6)
  return prevWidth * 0.65 + target * 0.35
}

const mid = (a: InkPoint, b: InkPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/** Dibuja el segmento que termina en points[i] (llamar en orden para i = 0..n-1). */
export function drawSegment(ctx: CanvasRenderingContext2D, stroke: Stroke, i: number): void {
  const pts = stroke.points
  const p = pts[i]
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (i === 0) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const prev = pts[i - 1]
  const start = i === 1 ? prev : mid(pts[i - 2], prev)
  const end = mid(prev, p)
  ctx.lineWidth = (prev.w + p.w) / 2
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.quadraticCurveTo(prev.x, prev.y, end.x, end.y)
  ctx.stroke()
}

/** Cierra el trazo: une el último punto medio con el punto final. */
export function drawTail(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points
  if (pts.length < 2) return
  const last = pts[pts.length - 1]
  const start = mid(pts[pts.length - 2], last)
  ctx.lineWidth = last.w
  ctx.strokeStyle = stroke.color
  ctx.beginPath()
  ctx.moveTo(start.x, start.y)
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  for (let i = 0; i < stroke.points.length; i++) drawSegment(ctx, stroke, i)
  drawTail(ctx, stroke)
}

/** Exporta los trazos como PNG transparente recortado, a `scale`× para que sea nítido al imprimir. */
export function strokesToPng(strokes: Stroke[], scale = 3): { dataUrl: string; width: number; height: number } {
  const pad = MAX_WIDTH
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes) for (const p of s.points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y)
  }
  const width = Math.ceil((maxX - minX + pad * 2) * scale)
  const height = Math.ceil((maxY - minY + pad * 2) * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.translate(pad - minX, pad - minY)
  strokes.forEach((s) => drawStroke(ctx, s))
  return { dataUrl: canvas.toDataURL('image/png'), width, height }
}
