// pdf.js para renderizar páginas. Se usa la build "legacy" por compatibilidad con
// versiones de Safari iOS que no tienen las últimas APIs de JS.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy
export type PdfPage = pdfjs.PDFPageProxy

/** Abre un PDF. pdf.js transfiere el buffer al worker, así que se pasa una copia. */
export async function openPdf(bytes: ArrayBuffer): Promise<PdfDoc> {
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
  } catch (err) {
    if ((err as Error).name === 'PasswordException') {
      throw new Error('El PDF está protegido con contraseña. Desbloquéalo primero.')
    }
    throw err
  }
}

/** Libera el documento y su worker (en v6 `destroy` vive en el loadingTask). */
export function closePdf(doc: PdfDoc): Promise<void> {
  return doc.loadingTask.destroy()
}

/** Renderiza una página en un canvas con el ancho CSS indicado (nítido en pantallas Retina). */
export async function renderPage(page: PdfPage, canvas: HTMLCanvasElement, cssWidth: number): Promise<void> {
  const base = page.getViewport({ scale: 1 })
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvas, viewport }).promise
}

/** Miniatura JPEG de la primera página (object URL; liberar con URL.revokeObjectURL). */
export async function firstPageThumbnail(pdf: Blob, cssWidth = 300): Promise<string> {
  const doc = await openPdf(await pdf.arrayBuffer())
  try {
    const canvas = document.createElement('canvas')
    await renderPage(await doc.getPage(1), canvas, cssWidth)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ? URL.createObjectURL(blob) : ''
  } finally {
    void closePdf(doc)
  }
}
