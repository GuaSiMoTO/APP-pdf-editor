import { useEffect, useRef, useState, type RefObject } from 'react'
import { isRenderCancelled, startRender, type PdfDoc, type RenderTask } from '../lib/pdfjs'

export type PageCanvasStatus = 'idle' | 'ready' | 'error'

/** Margen alrededor de la pantalla en el que una página se mantiene renderizada. */
const KEEP_MARGIN = '1200px 0px'

/** Renderiza una página de un PDF solo mientras está cerca de la pantalla.
 *  Al alejarse cancela el render y libera el canvas: una página a 760 px y 2× ocupa
 *  ~10 MB, y sin liberar, recorrer un documento largo agota la memoria de Safari iOS. */
export function usePageCanvas(doc: PdfDoc, index: number, cssWidth: number, observeRef?: RefObject<HTMLDivElement | null>) {
  const ownRef = useRef<HTMLDivElement>(null)
  const wrapRef = observeRef ?? ownRef
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [near, setNear] = useState(false)
  const [status, setStatus] = useState<PageCanvasStatus>('idle')

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: KEEP_MARGIN })
    io.observe(wrapRef.current!)
    return () => io.disconnect()
  }, [wrapRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!near || !cssWidth || !canvas) return
    let cancelled = false
    let task: RenderTask | null = null

    doc.getPage(index + 1)
      .then((page) => {
        if (cancelled) return
        task = startRender(page, canvas, cssWidth)
        return task.promise
      })
      .then(() => {
        if (!cancelled) setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled || isRenderCancelled(err)) return
        console.error(`No se pudo renderizar la página ${index + 1}`, err)
        setStatus('error')
      })

    return () => {
      cancelled = true
      task?.cancel()
      canvas.width = canvas.height = 0 // liberar memoria al momento
      setStatus('idle')
    }
  }, [near, doc, index, cssWidth])

  return { wrapRef, canvasRef, status }
}
