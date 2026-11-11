// Incrusta las firmas colocadas en el PDF original con pdf-lib.
import { degrees, PDFDocument, type PDFImage } from 'pdf-lib'
import type { PdfDoc } from '../lib/pdfjs'

/** Firma colocada en una página. Coordenadas normalizadas (0–1) respecto a la página
 *  tal como se ve (con su rotación aplicada), origen arriba a la izquierda. */
export interface Placement {
  id: string
  page: number // índice 0-based
  signatureId: string
  dataUrl: string
  nx: number
  ny: number
  nw: number
  aspect: number // alto / ancho de la imagen de la firma
}

export async function stampSignatures(original: ArrayBuffer, view: PdfDoc, placements: Placement[]): Promise<Blob> {
  const pdf = await PDFDocument.load(original)
  const images = new Map<string, PDFImage>()

  for (const pl of placements) {
    let img = images.get(pl.signatureId)
    if (!img) {
      img = await pdf.embedPng(pl.dataUrl)
      images.set(pl.signatureId, img)
    }

    // Viewport a escala 1 = unidades PDF. pdf.js resuelve rotación y CropBox.
    const pageView = await view.getPage(pl.page + 1)
    const vp = pageView.getViewport({ scale: 1 })
    const x = pl.nx * vp.width
    const y = pl.ny * vp.height
    const width = pl.nw * vp.width
    const height = width * pl.aspect
    // Esquina inferior-izquierda de la firma tal como se ve → espacio PDF
    const [px, py] = vp.convertToPdfPoint(x, y + height) as [number, number]

    pdf.getPage(pl.page).drawImage(img, {
      x: px,
      y: py,
      width,
      height,
      // Si la página tiene /Rotate, la imagen se gira igual para verse derecha
      rotate: degrees(pageView.rotate),
    })
  }

  const bytes = await pdf.save()
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' })
}
