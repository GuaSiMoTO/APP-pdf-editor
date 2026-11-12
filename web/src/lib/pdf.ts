import { PDFDocument } from 'pdf-lib'

/** A4 en puntos. */
const A4: [number, number] = [595.28, 841.89]

export interface ImagePdfOptions {
  /** 'fit': cada página con la proporción de su imagen (ancho A4). 'a4': A4 vertical u horizontal según la imagen. */
  pageSize?: 'fit' | 'a4'
  /** Margen en puntos (solo con 'a4'). */
  margin?: number
}

/** Crea un PDF con una imagen JPEG por página. */
export async function jpegsToPdf(images: Blob[], title?: string, opts: ImagePdfOptions = {}): Promise<Blob> {
  const { pageSize = 'fit', margin = 0 } = opts
  const pdf = await PDFDocument.create()
  if (title) pdf.setTitle(title)
  pdf.setCreator('Documentos')

  for (const blob of images) {
    const img = await pdf.embedJpg(await blob.arrayBuffer())
    if (pageSize === 'fit') {
      const height = (A4[0] * img.height) / img.width
      pdf.addPage([A4[0], height]).drawImage(img, { x: 0, y: 0, width: A4[0], height })
      continue
    }
    const landscape = img.width > img.height
    const [pw, ph] = landscape ? [A4[1], A4[0]] : A4
    const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height)
    const w = img.width * scale
    const h = img.height * scale
    pdf.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
  }

  const bytes = await pdf.save()
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' })
}
