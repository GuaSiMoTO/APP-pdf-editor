import { PDFDocument } from 'pdf-lib'

/** Ancho de A4 en puntos; la altura de cada página sigue la proporción de su imagen. */
const PAGE_WIDTH = 595.28

/** Crea un PDF con una imagen JPEG por página. */
export async function jpegsToPdf(images: Blob[], title?: string): Promise<Blob> {
  const pdf = await PDFDocument.create()
  if (title) pdf.setTitle(title)
  pdf.setCreator('Documentos')

  for (const blob of images) {
    const img = await pdf.embedJpg(await blob.arrayBuffer())
    const height = (PAGE_WIDTH * img.height) / img.width
    const page = pdf.addPage([PAGE_WIDTH, height])
    page.drawImage(img, { x: 0, y: 0, width: PAGE_WIDTH, height })
  }

  const bytes = await pdf.save()
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' })
}
