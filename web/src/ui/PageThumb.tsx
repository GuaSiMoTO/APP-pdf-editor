import { useEffect, useRef, useState } from 'react'
import { pageThumbnail, type PdfDoc, type Thumb } from '../lib/pdfjs'

interface Props {
  doc: PdfDoc
  index: number
  rotation?: number // grados extra (múltiplo de 90)
}

/** Proporción alto/ancho del hueco de la miniatura (ver .tile-frame en index.css). */
const FRAME_ASPECT = 1.3

/** Miniatura de una página. Se genera al acercarse a la pantalla y se guarda como JPEG
 *  pequeño en caché (lib/pdfjs.ts). El giro se aplica con CSS, sin volver a renderizar. */
export function PageThumb({ doc, index, rotation = 0 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [thumb, setThumb] = useState<Thumb | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '600px 0px' })
    io.observe(ref.current!)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    pageThumbnail(doc, index).then(
      (t) => !cancelled && setThumb(t),
      (err) => {
        if (cancelled) return
        console.error(`Miniatura de la página ${index + 1}`, err)
        setFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [visible, doc, index])

  // Ancho de la imagen (en % del hueco) para que, girada, quepa entera
  let width = 100
  if (thumb) {
    const turned = rotation % 180 !== 0
    const w = thumb.width
    const h = thumb.height
    const s = turned ? Math.min(1 / h, FRAME_ASPECT / w) : Math.min(1 / w, FRAME_ASPECT / h)
    width = w * s * 100
  }

  return (
    <span ref={ref} className={`page-thumb-box${failed ? ' failed' : ''}`} title={failed ? 'No se pudo mostrar la página' : undefined}>
      {thumb && (
        <img src={thumb.url} alt="" draggable={false} className="page-thumb-img"
          style={{ width: `${width}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />
      )}
    </span>
  )
}
