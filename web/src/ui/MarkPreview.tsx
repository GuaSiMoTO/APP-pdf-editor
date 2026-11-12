import { useEffect, useRef, useState } from 'react'
import { renderPage, type PdfDoc } from '../lib/pdfjs'
import { CAP_HEIGHT, type MarkStyle, type TextMark } from '../lib/textMarks'
import { useElementSize } from './useElementSize'

interface Props {
  doc: PdfDoc
  index: number
  /** Marcas para una página de W×H puntos (coordenadas vistas). */
  marks: (W: number, H: number) => TextMark[]
  style: MarkStyle
  maxHeight: number
}

/** Página real con las marcas superpuestas en SVG, usando la misma disposición que el PDF final. */
export function MarkPreview({ doc, index, marks, style, maxHeight }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = useElementSize(wrapRef)
  const [dims, setDims] = useState<{ W: number; H: number } | null>(null)

  useEffect(() => {
    void doc.getPage(index + 1).then((p) => {
      const vp = p.getViewport({ scale: 1 })
      setDims({ W: vp.width, H: vp.height })
    })
  }, [doc, index])

  const cssW = size && dims ? Math.min(size.width, (maxHeight * dims.W) / dims.H) : 0

  useEffect(() => {
    if (!cssW || !canvasRef.current) return
    let cancelled = false
    void doc.getPage(index + 1).then((p) => {
      if (!cancelled && canvasRef.current) return renderPage(p, canvasRef.current, cssW)
    })
    return () => {
      cancelled = true
    }
  }, [doc, index, cssW])

  return (
    <div ref={wrapRef} className="mark-preview">
      {dims && cssW > 0 && (
        <div className="mark-page" style={{ width: cssW, height: (cssW * dims.H) / dims.W }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          <svg viewBox={`0 0 ${dims.W} ${dims.H}`} aria-hidden="true">
            {marks(dims.W, dims.H).map((m, i) => (
              <text
                key={i}
                x={m.x}
                y={m.y}
                dy={m.anchor === 'center' ? (m.size * CAP_HEIGHT) / 2 : 0}
                fontSize={m.size}
                textAnchor={m.align}
                transform={m.angle ? `rotate(${-m.angle} ${m.x} ${m.y})` : undefined}
                fill={style.color}
                fillOpacity={style.opacity}
                fontWeight={style.bold ? 700 : 400}
                fontFamily="Helvetica, Arial, sans-serif"
              >
                {m.text}
              </text>
            ))}
          </svg>
        </div>
      )}
    </div>
  )
}
