import { useEffect, useRef } from 'react'
import { fitScale, useElementSize } from './useElementSize'

/** Muestra un canvas fuera de pantalla escalado para caber en el área disponible. */
export function FitCanvas({ source, className }: { source: HTMLCanvasElement; className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useElementSize(stageRef)
  const scale = fitScale(size, source.width, source.height)
  const w = source.width * scale
  const h = source.height * scale

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  }, [source, w, h])

  return (
    <div ref={stageRef} className="stage-inner">
      {w > 0 && <canvas ref={canvasRef} className={className} style={{ width: w, height: h }} />}
    </div>
  )
}
