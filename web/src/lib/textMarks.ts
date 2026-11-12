// Marcas de texto sobre páginas (marca de agua, números de página).
// La disposición se calcula en coordenadas "vistas" con funciones puras que usan
// tanto la vista previa (SVG) como el PDF final, para que coincidan.
import { UserError } from './errors'
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { viewOf } from './pageGeometry'

export interface TextMark {
  text: string
  x: number
  y: number
  size: number
  angle: number // grados, antihorario tal como se ve
  align: 'start' | 'middle' | 'end'
  /** 'center': (x,y) es el centro del texto; 'baseline': (x,y) está en la línea base. */
  anchor: 'center' | 'baseline'
}

export interface MarkStyle {
  color: string // #rrggbb
  opacity: number
  bold: boolean
}

/** Altura de mayúsculas de Helvetica (718/1000 em). */
export const CAP_HEIGHT = 0.718
/** Ancho medio aproximado de un carácter en Helvetica Bold (para el mosaico). */
const AVG_CHAR = 0.6

// ---------- Marca de agua ----------

export interface WatermarkOptions {
  text: string
  size: 'S' | 'M' | 'L'
  layout: 'center' | 'mosaic'
  diagonal: boolean
}

const WM_SIZE = { S: 0.07, M: 0.11, L: 0.16 }

export function watermarkMarks(W: number, H: number, o: WatermarkOptions): TextMark[] {
  const text = o.text.trim()
  if (!text) return []
  const angle = o.diagonal ? 45 : 0
  let size = Math.min(W, H) * WM_SIZE[o.size]
  if (o.layout === 'center') {
    // Que quepa en la página
    const room = o.diagonal ? Math.hypot(W, H) * 0.75 : W * 0.88
    size = Math.min(size, room / (AVG_CHAR * text.length))
    return [{ text, x: W / 2, y: H / 2, size, angle, align: 'middle', anchor: 'center' }]
  }
  size *= 0.55
  const stepX = AVG_CHAR * size * text.length + size * 3
  const stepY = size * 4.5
  const marks: TextMark[] = []
  const reach = Math.hypot(W, H)
  for (let row = 0, y = (H - reach) / 2; y <= (H + reach) / 2; row++, y += stepY) {
    const offset = row % 2 ? stepX / 2 : 0
    for (let x = (W - reach) / 2 + offset; x <= (W + reach) / 2; x += stepX) {
      // Solo las que caen cerca de la página
      if (x > -stepX && x < W + stepX && y > -stepY && y < H + stepY) {
        marks.push({ text, x, y, size, angle, align: 'middle', anchor: 'center' })
      }
    }
  }
  return marks
}

// ---------- Números de página ----------

export type NumberPosition = 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br'
export type NumberFormat = 'n' | 'n-of' | 'page-n-of'

export interface NumberOptions {
  position: NumberPosition
  format: NumberFormat
  size: 'S' | 'M' | 'L'
  start: number // número de la primera página
  skipFirst: boolean // no numerar la portada (pero cuenta)
}

const NUM_SIZE = { S: 8, M: 10, L: 13 }

export function numberText(o: NumberOptions, index: number, total: number): string {
  const n = o.start + index
  const last = o.start + total - 1
  if (o.format === 'n-of') return `${n} / ${last}`
  if (o.format === 'page-n-of') return `Página ${n} de ${last}`
  return `${n}`
}

export function numberMarks(W: number, H: number, o: NumberOptions, index: number, total: number): TextMark[] {
  if (o.skipFirst && index === 0) return []
  const scale = Math.min(W, H) / 595 // relativo a A4
  const size = NUM_SIZE[o.size] * scale
  const margin = Math.max(16, Math.min(W, H) * 0.05)
  const top = o.position[0] === 't'
  const h = o.position[1]
  return [{
    text: numberText(o, index, total),
    x: h === 'l' ? margin : h === 'r' ? W - margin : W / 2,
    y: top ? margin + size * CAP_HEIGHT : H - margin,
    size,
    angle: 0,
    align: h === 'l' ? 'start' : h === 'r' ? 'end' : 'middle',
    anchor: 'baseline',
  }]
}

// ---------- Aplicar al PDF ----------

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Dibuja en cada página las marcas que devuelva `marksFor`. */
export async function applyTextMarks(
  bytes: ArrayBuffer,
  marksFor: (W: number, H: number, index: number, total: number) => TextMark[],
  style: MarkStyle,
): Promise<Blob> {
  const pdf = await PDFDocument.load(bytes)
  const font = await pdf.embedFont(style.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica)
  const color = hexToRgb(style.color)
  const pages = pdf.getPages()

  pages.forEach((page, i) => {
    const view = viewOf(page)
    for (const m of marksFor(view.W, view.H, i, pages.length)) {
      let width: number
      try {
        width = font.widthOfTextAtSize(m.text, m.size)
      } catch {
        throw new UserError('El texto contiene caracteres no admitidos (p. ej. emojis).')
      }
      const dx = m.align === 'start' ? 0 : m.align === 'middle' ? width / 2 : width
      const dy = m.anchor === 'center' ? (m.size * CAP_HEIGHT) / 2 : 0
      const t = (m.angle * Math.PI) / 180
      // Origen (línea base, izquierda) en coordenadas vistas (y hacia abajo)
      const ox = m.x - dx * Math.cos(t) + dy * Math.sin(t)
      const oy = m.y + dx * Math.sin(t) + dy * Math.cos(t)
      const [x, y] = view.toUser(ox, oy)
      page.drawText(m.text, {
        x, y, size: m.size, font, color, opacity: style.opacity,
        rotate: degrees(m.angle + view.rotation),
      })
    }
  })

  const out = await pdf.save()
  return new Blob([out.slice().buffer], { type: 'application/pdf' })
}
