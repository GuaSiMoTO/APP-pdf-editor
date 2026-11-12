import { describe, expect, it } from 'vitest'
import { makePdf, openPdfjs, TRICKY_PAGES, viewedText } from '../test/pdfHelpers'
import { applyAnnotations, markStrokes, moved, resized, textBaselines, type Annot, type MarkAnnot, type RectAnnot, type TextAnnot } from './annotations'

const text = (page: number): TextAnnot => ({ id: `t${page}`, page, kind: 'text', x: 60, y: 100, text: 'Línea uno\nSegunda ñ', size: 14, color: '#1c1c1e' })

describe('applyAnnotations', () => {
  it('el texto multilínea queda en su sitio y horizontal en cualquier página', async () => {
    const bytes = await makePdf(TRICKY_PAGES)
    const annots = TRICKY_PAGES.map((_, i) => text(i))
    const out = await openPdfjs(await applyAnnotations(bytes, annots))

    for (let i = 0; i < TRICKY_PAGES.length; i++) {
      const lines = await viewedText(out, i + 1)
      const expected = textBaselines(annots[i])
      expect(lines.map((l) => l.text), TRICKY_PAGES[i].label).toEqual(['Línea uno', 'Segunda ñ'])
      lines.forEach((l, j) => {
        expect(l.angle).toBe(0)
        expect(l.x).toBeCloseTo(expected[j][0], 0)
        expect(l.y).toBeCloseTo(expected[j][1], 0)
      })
    }
  })

  it('genera todos los tipos de anotación sin errores', async () => {
    const bytes = await makePdf(TRICKY_PAGES)
    const annots: Annot[] = TRICKY_PAGES.flatMap((_, page): Annot[] => [
      { id: `r${page}`, page, kind: 'rect', x: 50, y: 300, w: 200, h: 30, style: 'highlight', color: '#ffcc00' },
      { id: `c${page}`, page, kind: 'rect', x: 50, y: 400, w: 120, h: 40, style: 'cover', color: '#ffffff' },
      { id: `m${page}`, page, kind: 'mark', x: 300, y: 300, s: 18, symbol: 'check', color: '#007aff' },
      { id: `k${page}`, page, kind: 'ink', points: [[100, 500], [150, 520], [200, 510]], width: 2, color: '#ff3b30' },
      { id: `d${page}`, page, kind: 'ink', points: [[400, 600]], width: 4, color: '#ff3b30' },
    ])
    const out = await applyAnnotations(bytes, annots)
    expect((await openPdfjs(out)).numPages).toBe(TRICKY_PAGES.length)
  })

  it('los emojis dan un error claro', async () => {
    const bytes = await makePdf([{ label: 'normal' }])
    await expect(applyAnnotations(bytes, [{ ...text(0), text: 'Hola 😀' }])).rejects.toThrow(/no admitidos/)
  })
})

describe('geometría de anotaciones', () => {
  it('moved desplaza cualquier tipo', () => {
    const r: RectAnnot = { id: 'r', page: 0, kind: 'rect', x: 10, y: 20, w: 5, h: 5, style: 'cover', color: '#fff' }
    expect(moved(r, 3, -2)).toMatchObject({ x: 13, y: 18 })
    const ink: Annot = { id: 'i', page: 0, kind: 'ink', points: [[0, 0], [1, 1]], width: 1, color: '#000' }
    expect(moved(ink, 1, 1)).toMatchObject({ points: [[1, 1], [2, 2]] })
  })

  it('resized respeta tamaños mínimos y mantiene ✓/✗ cuadradas', () => {
    const r: RectAnnot = { id: 'r', page: 0, kind: 'rect', x: 0, y: 0, w: 50, h: 50, style: 'cover', color: '#fff' }
    expect(resized(r, 1, 1)).toMatchObject({ w: 4, h: 4 })
    const m: MarkAnnot = { id: 'm', page: 0, kind: 'mark', x: 0, y: 0, s: 10, symbol: 'cross', color: '#000' }
    expect(resized(m, 30, 20)).toMatchObject({ s: 20 })
  })

  it('✓ es un trazo y ✗ son dos', () => {
    const m: MarkAnnot = { id: 'm', page: 0, kind: 'mark', x: 0, y: 0, s: 10, symbol: 'check', color: '#000' }
    expect(markStrokes(m)).toHaveLength(1)
    expect(markStrokes({ ...m, symbol: 'cross' })).toHaveLength(2)
  })
})
