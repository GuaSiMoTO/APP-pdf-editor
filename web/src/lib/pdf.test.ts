import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { jpeg1px } from '../test/pdfHelpers'
import { jpegsToPdf } from './pdf'

const firstPage = async (blob: Blob) => (await PDFDocument.load(await blob.arrayBuffer())).getPage(0)

describe('jpegsToPdf', () => {
  it("'fit': página con la proporción de la imagen y ancho A4", async () => {
    const page = await firstPage(await jpegsToPdf([jpeg1px()], 't', { pageSize: 'fit' }))
    expect(page.getWidth()).toBeCloseTo(595.28, 1)
    expect(page.getHeight()).toBeCloseTo(595.28, 1)
  })

  it("'a4': página A4 vertical para una imagen cuadrada", async () => {
    const page = await firstPage(await jpegsToPdf([jpeg1px()], 't', { pageSize: 'a4', margin: 40 }))
    expect(page.getWidth()).toBeCloseTo(595.28, 1)
    expect(page.getHeight()).toBeCloseTo(841.89, 1)
  })

  it('guarda el título y una página por imagen', async () => {
    const doc = await PDFDocument.load(await (await jpegsToPdf([jpeg1px(), jpeg1px()], 'Mi escaneo')).arrayBuffer())
    expect(doc.getTitle()).toBe('Mi escaneo')
    expect(doc.getPageCount()).toBe(2)
  })
})
