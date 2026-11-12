import { useEffect, useState } from 'react'
import { closePdf, openPdf, type PdfDoc } from './pdfjs'

/** PDF abierto: bytes originales (para pdf-lib) + documento pdf.js (para pintar). */
export interface OpenPdf {
  file: File
  bytes: ArrayBuffer
  view: PdfDoc
  aspects: number[] // alto/ancho de cada página tal como se ve
  sizes: { W: number; H: number }[] // tamaño visto en puntos PDF (= viewOf(page) de pdf-lib)
}

export async function loadPdfFile(file: File): Promise<OpenPdf> {
  const bytes = await file.arrayBuffer()
  const view = await openPdf(bytes)
  const aspects: number[] = []
  const sizes: { W: number; H: number }[] = []
  for (let i = 1; i <= view.numPages; i++) {
    const vp = (await view.getPage(i)).getViewport({ scale: 1 })
    aspects.push(vp.height / vp.width)
    sizes.push({ W: vp.width, H: vp.height })
  }
  return { file, bytes, view, aspects, sizes }
}

/** Estado de un PDF abierto; al sustituirlo o desmontar se libera el anterior. */
export function useOpenPdf() {
  const [doc, setDoc] = useState<OpenPdf | null>(null)
  useEffect(() => () => void (doc && closePdf(doc.view)), [doc])
  return [doc, setDoc] as const
}
