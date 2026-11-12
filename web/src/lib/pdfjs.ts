// pdf.js para renderizar páginas. Se usa la build "legacy" por compatibilidad con
// versiones de Safari iOS que no tienen las últimas APIs de JS.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { UserError } from './errors'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDoc = pdfjs.PDFDocumentProxy
export type PdfPage = pdfjs.PDFPageProxy
export type RenderTask = ReturnType<PdfPage['render']>

/** Más nitidez que 2× apenas se aprecia y multiplica la memoria (×2,25 a 3×). */
const MAX_DPR = 2
/** Píxeles máximos de un canvas de página (iOS limita a ~16,7 MP por canvas). */
const MAX_CANVAS_PIXELS = 12_000_000

/** Abre un PDF. pdf.js transfiere el buffer al worker, así que se pasa una copia. */
export async function openPdf(bytes: ArrayBuffer): Promise<PdfDoc> {
  try {
    // pdf.js v6 no compila código desde el PDF (sin eval/new Function: cubre CVE-2024-4367)
    return await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
  } catch (err) {
    const name = (err as Error).name
    if (name === 'PasswordException') {
      throw new UserError('El PDF está protegido con contraseña. Desbloquéalo primero.', { cause: err })
    }
    if (name === 'InvalidPDFException' || name === 'FormatError') {
      throw new UserError('El archivo no es un PDF válido o está dañado. Prueba con la herramienta Reparar.', { cause: err })
    }
    throw err
  }
}

/** Libera el documento, su worker y sus miniaturas (en v6 `destroy` vive en el loadingTask).
 *  Es limpieza: nunca rechaza (un fallo solo se registra), así que puede llamarse con `void`. */
export function closePdf(doc: PdfDoc): Promise<void> {
  const thumbs = thumbCache.get(doc)
  thumbCache.delete(doc)
  thumbs?.forEach((p) => void p.then((t) => URL.revokeObjectURL(t.url), () => undefined))
  return doc.loadingTask.destroy().catch((err: unknown) => console.error('Error al cerrar el PDF', err))
}

/** Empieza a renderizar una página con el ancho CSS indicado. Devuelve la tarea para poder
 *  cancelarla (p. ej. si la página sale de pantalla antes de terminar). */
export function startRender(page: PdfPage, canvas: HTMLCanvasElement, cssWidth: number): RenderTask {
  const base = page.getViewport({ scale: 1 })
  let scale = (cssWidth / base.width) * Math.min(window.devicePixelRatio || 1, MAX_DPR)
  const pixels = base.width * base.height * scale * scale
  if (pixels > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / pixels)
  const viewport = page.getViewport({ scale })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  return page.render({ canvas, viewport })
}

export async function renderPage(page: PdfPage, canvas: HTMLCanvasElement, cssWidth: number): Promise<void> {
  await startRender(page, canvas, cssWidth).promise
}

export function isRenderCancelled(err: unknown): boolean {
  return (err as Error)?.name === 'RenderingCancelledException'
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob devolvió null'))), 'image/jpeg', quality),
  )
}

/** Miniatura JPEG de la primera página (object URL; liberar con URL.revokeObjectURL).
 *  Es decorativa: si falla, devuelve '' y la interfaz muestra un icono. */
export async function firstPageThumbnail(pdf: Blob, cssWidth = 300): Promise<string> {
  let doc: PdfDoc | null = null
  const canvas = document.createElement('canvas')
  try {
    doc = await openPdf(await pdf.arrayBuffer())
    await renderPage(await doc.getPage(1), canvas, cssWidth)
    return URL.createObjectURL(await canvasToJpeg(canvas, 0.85))
  } catch (err) {
    console.error('Miniatura no disponible', err)
    return ''
  } finally {
    canvas.width = canvas.height = 0
    if (doc) void closePdf(doc)
  }
}

// ---------- Miniaturas de página (rejillas) ----------

export interface Thumb {
  url: string
  width: number
  height: number
}

/** Ancho en px de las miniaturas: ~2× del tamaño en pantalla (≈110 px CSS). */
const THUMB_PX = 240
/** JPEG (~20 KB) en vez de canvas (~0,7–1,6 MB): con cientos de páginas cabe en memoria. */
const thumbCache = new Map<PdfDoc, Map<number, Promise<Thumb>>>()

export function pageThumbnail(doc: PdfDoc, index: number): Promise<Thumb> {
  let pages = thumbCache.get(doc)
  if (!pages) thumbCache.set(doc, (pages = new Map()))
  const cached = pages.get(index)
  if (cached) return cached

  const job = (async () => {
    const page = await doc.getPage(index + 1)
    const canvas = document.createElement('canvas')
    try {
      // renderPage aplica el dpr; aquí se quiere un tamaño fijo en px
      await renderPage(page, canvas, THUMB_PX / Math.min(window.devicePixelRatio || 1, MAX_DPR))
      const blob = await canvasToJpeg(canvas, 0.8)
      return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height }
    } finally {
      canvas.width = canvas.height = 0
    }
  })()
  pages.set(index, job)
  // Si falla, se quita de la caché para poder reintentar
  job.catch(() => pages.delete(index))
  return job
}
