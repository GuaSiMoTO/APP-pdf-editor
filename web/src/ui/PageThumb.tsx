import { useEffect, useRef, useState } from 'react'
import { renderPage, type PdfDoc } from '../lib/pdfjs'
import { rotate } from '../scan/image'

const THUMB_WIDTH = 180 // px CSS de render; se escala con CSS

// Caché por documento: reordenar o girar no vuelve a renderizar la página.
const cache = new WeakMap<PdfDoc, Map<number, Promise<HTMLCanvasElement>>>()

function thumbnail(doc: PdfDoc, index: number): Promise<HTMLCanvasElement> {
  let pages = cache.get(doc)
  if (!pages) cache.set(doc, (pages = new Map()))
  let p = pages.get(index)
  if (!p) {
    p = doc.getPage(index + 1).then(async (page) => {
      const canvas = document.createElement('canvas')
      await renderPage(page, canvas, THUMB_WIDTH)
      return canvas
    })
    pages.set(index, p)
  }
  return p
}

interface Props {
  doc: PdfDoc
  index: number
  rotation?: number // grados extra (múltiplo de 90)
}

/** Miniatura de una página; se renderiza al acercarse a la pantalla. */
export function PageThumb({ doc, index, rotation = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current!
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void thumbnail(doc, index).then((base) => {
      const canvas = ref.current
      if (cancelled || !canvas) return
      const img = rotate(base, rotation / 90)
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      canvas.classList.add('ready')
    })
    return () => {
      cancelled = true
    }
  }, [visible, doc, index, rotation])

  return <canvas ref={ref} className="page-thumb-canvas" width={100} height={141} />
}
