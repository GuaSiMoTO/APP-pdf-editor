import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { makePdf, openPdfjs, TRICKY_PAGES } from '../test/pdfHelpers'
import { viewOf } from './pageGeometry'

describe('viewOf', () => {
  it.each(TRICKY_PAGES.map((c, i) => [c.label, i] as const))(
    'coincide con convertToPdfPoint de pdf.js (%s)',
    async (_label, i) => {
      const bytes = await makePdf(TRICKY_PAGES)
      const view = viewOf((await PDFDocument.load(bytes)).getPage(i))
      const vp = (await (await openPdfjs(bytes)).getPage(i + 1)).getViewport({ scale: 1 })

      expect(view.W).toBeCloseTo(vp.width, 2)
      expect(view.H).toBeCloseTo(vp.height, 2)
      for (const [x, y] of [[0, 0], [100, 50], [view.W, view.H], [12.5, 700]]) {
        const [ux, uy] = view.toUser(x, y)
        const [px, py] = vp.convertToPdfPoint(x, y) as [number, number]
        expect(ux).toBeCloseTo(px, 2)
        expect(uy).toBeCloseTo(py, 2)
      }
    },
  )
})
