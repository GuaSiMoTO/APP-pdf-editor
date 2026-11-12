// Geometría de una página "tal como se ve" (con /Rotate y CropBox aplicados) para pdf-lib.
// Coordenadas vistas: origen arriba-izquierda, y hacia abajo, en puntos PDF.
// Equivale a viewport.convertToPdfPoint de pdf.js (verificado en pruebas).
import type { PDFPage } from 'pdf-lib'

export interface PageView {
  W: number // ancho visto
  H: number // alto visto
  rotation: number // /Rotate normalizado (0, 90, 180, 270)
  toUser: (vx: number, vy: number) => [number, number]
}

export function viewOf(page: PDFPage): PageView {
  const { x, y, width: w, height: h } = page.getCropBox()
  const r = ((page.getRotation().angle % 360) + 360) % 360
  const swap = r === 90 || r === 270
  const toUser = (vx: number, vy: number): [number, number] => {
    switch (r) {
      case 90: return [x + vy, y + vx]
      case 180: return [x + w - vx, y + vy]
      case 270: return [x + w - vy, y + h - vx]
      default: return [x + vx, y + h - vy]
    }
  }
  return { W: swap ? h : w, H: swap ? w : h, rotation: r, toUser }
}
