import { PDFDocument, StandardFonts } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { makePdf, openPdfjs, TRICKY_PAGES, viewedText } from '../test/pdfHelpers'
import { applyTextMarks, CAP_HEIGHT, numberMarks, numberText, watermarkMarks, type NumberOptions, type WatermarkOptions } from './textMarks'

const NUM: NumberOptions = { position: 'br', format: 'n-of', size: 'M', start: 1, skipFirst: false }
const WM: WatermarkOptions = { text: 'CONFIDENCIAL', size: 'M', layout: 'center', diagonal: true }
const fonts = async () => {
  const doc = await PDFDocument.create()
  return { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) }
}

describe('applyTextMarks: números de página', () => {
  it('quedan abajo a la derecha y horizontales en cualquier página', async () => {
    const { regular } = await fonts()
    const bytes = await makePdf(TRICKY_PAGES)
    const out = await openPdfjs(await applyTextMarks(bytes, (W, H, i, n) => numberMarks(W, H, NUM, i, n), { color: '#3a3a3c', opacity: 1, bold: false }))

    for (let i = 0; i < TRICKY_PAGES.length; i++) {
      const [text] = await viewedText(out, i + 1)
      const page = await out.getPage(i + 1)
      const { width: W, height: H } = page.getViewport({ scale: 1 })
      const mark = numberMarks(W, H, NUM, i, TRICKY_PAGES.length)[0]
      expect(text.text, TRICKY_PAGES[i].label).toBe(`${i + 1} / ${TRICKY_PAGES.length}`)
      expect(text.angle, TRICKY_PAGES[i].label).toBe(0)
      expect(text.x).toBeCloseTo(mark.x - regular.widthOfTextAtSize(mark.text, mark.size), 0)
      expect(text.y).toBeCloseTo(mark.y, 0)
    }
  })
})

describe('applyTextMarks: marca de agua', () => {
  it('queda centrada y a 45° en cualquier página', async () => {
    const { bold } = await fonts()
    const bytes = await makePdf(TRICKY_PAGES)
    const out = await openPdfjs(await applyTextMarks(bytes, (W, H) => watermarkMarks(W, H, WM), { color: '#ff3b30', opacity: 0.3, bold: true }))

    for (let i = 0; i < TRICKY_PAGES.length; i++) {
      const [text] = await viewedText(out, i + 1)
      const { width: W, height: H } = (await out.getPage(i + 1)).getViewport({ scale: 1 })
      const m = watermarkMarks(W, H, WM)[0]
      // Origen esperado: centro − media anchura a lo largo del texto − media altura de mayúsculas
      const half = bold.widthOfTextAtSize(m.text, m.size) / 2
      const dy = (m.size * CAP_HEIGHT) / 2
      const t = Math.PI / 4
      expect(text.angle, TRICKY_PAGES[i].label).toBe(45)
      expect(text.x).toBeCloseTo(m.x - half * Math.cos(t) + dy * Math.sin(t), 0)
      expect(text.y).toBeCloseTo(m.y + half * Math.sin(t) + dy * Math.cos(t), 0)
    }
  })

  it('el mosaico genera varias marcas', () => {
    expect(watermarkMarks(595, 842, { ...WM, layout: 'mosaic' }).length).toBeGreaterThan(10)
  })

  it('un texto vacío no genera marcas', () => {
    expect(watermarkMarks(595, 842, { ...WM, text: '   ' })).toEqual([])
  })

  it('los emojis dan un error claro', async () => {
    const bytes = await makePdf([{ label: 'normal' }])
    await expect(applyTextMarks(bytes, (W, H) => watermarkMarks(W, H, { ...WM, text: 'Hola 😀' }), { color: '#000000', opacity: 1, bold: true }))
      .rejects.toThrow(/caracteres no admitidos/)
  })
})

describe('numberMarks / numberText', () => {
  it('no numera la portada si se pide', () => {
    expect(numberMarks(595, 842, { ...NUM, skipFirst: true }, 0, 5)).toEqual([])
    expect(numberMarks(595, 842, { ...NUM, skipFirst: true }, 1, 5)).toHaveLength(1)
  })

  it('formatos y número inicial', () => {
    expect(numberText({ ...NUM, format: 'n' }, 0, 5)).toBe('1')
    expect(numberText({ ...NUM, format: 'n-of' }, 1, 5)).toBe('2 / 5')
    expect(numberText({ ...NUM, format: 'page-n-of', start: 3 }, 1, 5)).toBe('Página 4 de 7')
  })
})
