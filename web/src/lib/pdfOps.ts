// Operaciones de páginas con pdf-lib (en el navegador): unir, extraer, reordenar, girar.
import { degrees, PDFDocument } from 'pdf-lib'

/** Página de salida: página `page` (0-based) del documento fuente `source`, con giro extra opcional. */
export interface PageRef {
  source: number
  page: number
  rotate?: number // grados extra, múltiplo de 90
}

async function loadSource(bytes: ArrayBuffer): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes)
  } catch (err) {
    if ((err as Error).name === 'EncryptedPDFError' || /encrypt/i.test((err as Error).message)) {
      throw new Error('Uno de los PDF está protegido con contraseña. Desbloquéalo primero.')
    }
    throw err
  }
}

/** Construye uno o varios PDF a partir de páginas de los documentos fuente.
 *  Cada fuente se carga una vez, y las páginas se copian en bloque por fuente
 *  para que fuentes e imágenes compartidas no se dupliquen. */
export async function buildPdfs(sources: ArrayBuffer[], outputs: PageRef[][]): Promise<Blob[]> {
  const docs = await Promise.all(sources.map(loadSource))
  const results: Blob[] = []

  for (const refs of outputs) {
    const out = await PDFDocument.create()
    const copied = new Map<string, ReturnType<PDFDocument['getPage']>>()
    for (let s = 0; s < docs.length; s++) {
      const wanted = [...new Set(refs.filter((r) => r.source === s).map((r) => r.page))]
      if (!wanted.length) continue
      const pages = await out.copyPages(docs[s], wanted)
      wanted.forEach((p, i) => copied.set(`${s}:${p}`, pages[i]))
    }
    for (const ref of refs) {
      // Repetir una página exige una copia nueva (un objeto página no puede añadirse dos veces)
      const key = `${ref.source}:${ref.page}`
      let page = copied.get(key)!
      if (out.getPages().includes(page)) [page] = await out.copyPages(docs[ref.source], [ref.page])
      if (ref.rotate) page.setRotation(degrees((((page.getRotation().angle + ref.rotate) % 360) + 360) % 360))
      out.addPage(page)
    }
    const bytes = await out.save()
    results.push(new Blob([bytes.slice().buffer], { type: 'application/pdf' }))
  }
  return results
}

/** "1-3, 5, 8-10" → [[0,1,2],[4],[7,8,9]]. Lanza un Error legible si no es válido. */
export function parseRanges(text: string, pageCount: number): number[][] {
  const groups: number[][] = []
  for (const raw of text.split(/[,;]/)) {
    const token = raw.trim()
    if (!token) continue
    const m = token.match(/^(\d+)\s*(?:-\s*(\d+))?$/)
    if (!m) throw new Error(`"${token}" no es un rango válido`)
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < 1 || b < 1 || a > pageCount || b > pageCount) throw new Error(`El documento tiene ${pageCount} páginas`)
    if (b < a) throw new Error(`"${token}": el inicio es mayor que el final`)
    groups.push(Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i))
  }
  if (!groups.length) throw new Error('Escribe al menos un rango')
  return groups
}

/** [0,1,2] → "1-3"; [4] → "5" */
export function rangeLabel(pages: number[]): string {
  return pages.length === 1 ? `${pages[0] + 1}` : `${pages[0] + 1}-${pages[pages.length - 1] + 1}`
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '')
}

export function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Documento'
}
