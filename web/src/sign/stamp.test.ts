import { describe, expect, it } from 'vitest'
import { makePdf, openPdfjs, PNG_1PX, TRICKY_PAGES, viewedImageCorners } from '../test/pdfHelpers'
import { stampSignatures, type Placement } from './stamp'

describe('stampSignatures', () => {
  it('la firma queda exactamente donde se colocó y derecha en cualquier página', async () => {
    const bytes = await makePdf(TRICKY_PAGES)
    const view = await openPdfjs(bytes)
    const base = { signatureId: 's1', dataUrl: PNG_1PX, nx: 0.6, ny: 0.7, nw: 0.3, aspect: 0.4 }
    const placements: Placement[] = TRICKY_PAGES.map((_, page) => ({ ...base, id: `p${page}`, page }))

    const out = await openPdfjs(await stampSignatures(bytes, view, placements))

    for (let i = 0; i < TRICKY_PAGES.length; i++) {
      const { width: W, height: H } = (await out.getPage(i + 1)).getViewport({ scale: 1 })
      const w = base.nw * W
      const h = w * base.aspect
      const x = base.nx * W
      const y = base.ny * H
      const expected = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] // TL, TR, BR, BL
      const corners = await viewedImageCorners(out, i + 1)
      corners.forEach(([cx, cy], k) => {
        expect(cx, `${TRICKY_PAGES[i].label} esquina ${k}`).toBeCloseTo(expected[k][0], 0)
        expect(cy, `${TRICKY_PAGES[i].label} esquina ${k}`).toBeCloseTo(expected[k][1], 0)
      })
    }
  })
})
