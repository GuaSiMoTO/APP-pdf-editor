import { degrees, PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { buildPdfs, parseRanges, rangeLabel } from './pdfOps'

/** PDF de n páginas; el ancho (300 + i) identifica cada página. Fuente compartida. */
async function sample(n: number, rotateSecond = false): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i++) {
    const page = doc.addPage([300 + i, 400])
    page.drawText(`p${i}`, { x: 50, y: 200, size: 24, font })
    if (rotateSecond && i === 2) page.setRotation(degrees(90))
  }
  return (await doc.save()).slice().buffer
}

/** "ancho/rotación" de cada página del resultado. */
async function pages(blob: Blob): Promise<string[]> {
  const doc = await PDFDocument.load(await blob.arrayBuffer())
  return doc.getPages().map((p) => `${p.getWidth()}/${p.getRotation().angle}`)
}

const all = (source: number, n: number) => Array.from({ length: n }, (_, page) => ({ source, page }))

describe('buildPdfs', () => {
  it('une documentos en orden y conserva el /Rotate existente', async () => {
    const [out] = await buildPdfs([await sample(3), await sample(2, true)], [[...all(0, 3), ...all(1, 2)]])
    expect(await pages(out)).toEqual(['301/0', '302/0', '303/0', '301/0', '302/90'])
  })

  it('reordena y gira páginas', async () => {
    const [out] = await buildPdfs([await sample(3)], [[
      { source: 0, page: 2, rotate: 90 }, { source: 0, page: 0 }, { source: 0, page: 1, rotate: -90 },
    ]])
    expect(await pages(out)).toEqual(['303/90', '301/0', '302/270'])
  })

  it('suma el giro al /Rotate que ya tenía la página', async () => {
    const [out] = await buildPdfs([await sample(2, true)], [[{ source: 0, page: 1, rotate: 270 }]])
    expect(await pages(out)).toEqual(['302/0'])
  })

  it('permite repetir una página', async () => {
    const [out] = await buildPdfs([await sample(1)], [[{ source: 0, page: 0 }, { source: 0, page: 0 }]])
    expect(await pages(out)).toEqual(['301/0', '301/0'])
  })

  it('genera varios archivos (dividir)', async () => {
    const outs = await buildPdfs([await sample(3)], parseRanges('1-2, 3', 3).map((g) => g.map((page) => ({ source: 0, page }))))
    expect(await Promise.all(outs.map(pages))).toEqual([['301/0', '302/0'], ['303/0']])
  })

  it('no duplica la fuente compartida al copiar las páginas', async () => {
    const [out] = await buildPdfs([await sample(3), await sample(2)], [[...all(0, 3), ...all(1, 2)]])
    const doc = await PDFDocument.load(await out.arrayBuffer())
    const fonts = doc.context.enumerateIndirectObjects()
      .filter(([, obj]) => obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('Font'))
    expect(fonts).toHaveLength(2) // una por documento fuente, no una por página
  })

  it('avisa claramente si el PDF está cifrado', async () => {
    const encrypted = new TextEncoder().encode(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n' +
      'trailer<</Root 1 0 R/Encrypt<</Filter/Standard>>>>\n%%EOF',
    ).buffer as ArrayBuffer
    await expect(buildPdfs([encrypted], [[]])).rejects.toThrow(/contraseña/)
  })
})

describe('parseRanges', () => {
  it('interpreta rangos y páginas sueltas', () => {
    expect(parseRanges('1-3, 5', 5)).toEqual([[0, 1, 2], [4]])
    expect(parseRanges(' 2 ; 4-4 ', 5)).toEqual([[1], [3]])
  })

  it.each([
    ['0', /tiene 3 páginas/],
    ['4', /tiene 3 páginas/],
    ['3-1', /inicio es mayor/],
    ['a-b', /no es un rango válido/],
    ['', /al menos un rango/],
  ])('rechaza "%s"', (text, message) => {
    expect(() => parseRanges(text, 3)).toThrow(message)
  })
})

describe('rangeLabel', () => {
  it('formatea grupos de páginas', () => {
    expect(rangeLabel([0, 1, 2])).toBe('1-3')
    expect(rangeLabel([4])).toBe('5')
  })
})
