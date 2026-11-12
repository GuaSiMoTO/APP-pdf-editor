// Utilidades para los tests: crear PDFs de prueba y leer el resultado con pdf.js real,
// expresando posiciones en coordenadas "vistas" (como las ve el usuario).
import { degrees, PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

export interface PageCase {
  label: string
  size?: [number, number]
  rotate?: number
  crop?: [number, number, number, number]
}

/** Las variantes de página que rompen los cálculos ingenuos de coordenadas. */
export const TRICKY_PAGES: PageCase[] = [
  { label: 'normal' },
  { label: '/Rotate 90', rotate: 90 },
  { label: '/Rotate 180', rotate: 180 },
  { label: '/Rotate 270', rotate: 270 },
  { label: 'CropBox desplazado', size: [700, 900], crop: [50, 30, 595, 842] },
  { label: 'CropBox + /Rotate 90', size: [700, 900], crop: [50, 30, 595, 842], rotate: 90 },
]

export async function makePdf(cases: PageCase[]): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  for (const c of cases) {
    const page = doc.addPage(c.size ?? [595, 842])
    if (c.rotate) page.setRotation(degrees(c.rotate))
    if (c.crop) page.setCropBox(...c.crop)
  }
  return (await doc.save()).slice().buffer
}

export async function openPdfjs(data: ArrayBuffer | Blob) {
  const bytes = data instanceof Blob ? await data.arrayBuffer() : data
  return pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise
}

export type PdfjsDoc = Awaited<ReturnType<typeof openPdfjs>>

/** Textos de una página con su origen (línea base) y ángulo tal como se ven. */
export async function viewedText(doc: PdfjsDoc, pageNumber: number) {
  const page = await doc.getPage(pageNumber)
  const vp = page.getViewport({ scale: 1 })
  const { items } = await page.getTextContent()
  return items
    .filter((it): it is Extract<typeof it, { str: string }> => 'str' in it && it.str.trim() !== '')
    .map((it) => {
      const [a, b, , , e, f] = it.transform as number[]
      const [x, y] = vp.convertToViewportPoint(e, f)
      const [dx, dy] = vp.convertToViewportPoint(e + a, f + b)
      // `|| 0` convierte -0 en 0
      return { text: it.str, x, y, angle: Math.round((Math.atan2(-(dy - y), dx - x) * 180) / Math.PI) || 0 }
    })
}

/** Esquinas (TL, TR, BR, BL) en coordenadas vistas de la última imagen pintada en la página. */
export async function viewedImageCorners(doc: PdfjsDoc, pageNumber: number): Promise<[number, number][]> {
  const page = await doc.getPage(pageNumber)
  const vp = page.getViewport({ scale: 1 })
  const ops = await page.getOperatorList()
  type M = [number, number, number, number, number, number]
  const mul = (m: M, n: M): M => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  let ctm: M = [1, 0, 0, 1, 0, 0]
  const stack: M[] = []
  let image: M | null = null
  ops.fnArray.forEach((fn, k) => {
    if (fn === pdfjs.OPS.save) stack.push(ctm)
    else if (fn === pdfjs.OPS.restore) ctm = stack.pop()!
    else if (fn === pdfjs.OPS.transform) ctm = mul(ctm, ops.argsArray[k] as M)
    else if (fn === pdfjs.OPS.paintImageXObject) image = ctm
  })
  if (!image) throw new Error('La página no tiene imágenes')
  const m: M = image
  return ([[0, 1], [1, 1], [1, 0], [0, 0]] as const).map(([u, v]) => {
    const [x, y] = vp.convertToViewportPoint(m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5])
    return [x, y] as [number, number]
  })
}

/** PNG 1×1 rojo y JPEG 1×1 (para incrustar imágenes sin depender de archivos). */
export const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=='
const JPEG_1PX_B64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
export const jpeg1px = () => new Blob([Uint8Array.from(atob(JPEG_1PX_B64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' })
