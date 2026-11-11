import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { fitScale, useElementSize } from '../ui/useElementSize'
import type { Point, Quad } from './geometry'

const HANDLE_HIT = 44 // px: área táctil mínima recomendada por Apple
const LOUPE_SIZE = 112
const LOUPE_ZOOM = 2.5

interface Props {
  source: HTMLCanvasElement
  quad: Quad
  onChange: (quad: Quad) => void
}

/** Muestra la foto con el recorte detectado; las 4 esquinas se arrastran.
 *  Mientras se arrastra aparece una lupa para ajustar con precisión. */
export function CropEditor({ source, quad, onChange }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const loupeRef = useRef<HTMLCanvasElement>(null)
  const size = useElementSize(stageRef)
  const scale = fitScale(size, source.width, source.height)
  const dispW = source.width * scale
  const dispH = source.height * scale
  const [active, setActive] = useState<number | null>(null)

  // Vista previa reducida (no se pinta la foto completa en pantalla)
  useEffect(() => {
    const canvas = previewRef.current
    if (!canvas || !dispW) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(dispW * dpr)
    canvas.height = Math.round(dispH * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  }, [source, dispW, dispH])

  // Lupa
  useEffect(() => {
    const canvas = loupeRef.current
    if (active === null || !canvas || !scale) return
    const p = quad[active]
    const dpr = window.devicePixelRatio || 1
    canvas.width = LOUPE_SIZE * dpr
    canvas.height = LOUPE_SIZE * dpr
    const ctx = canvas.getContext('2d')!
    const half = LOUPE_SIZE / 2 / (scale * LOUPE_ZOOM)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, p.x - half, p.y - half, half * 2, half * 2, 0, 0, canvas.width, canvas.height)
    const c = canvas.width / 2
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'
    ctx.lineWidth = 1.5 * dpr
    ctx.beginPath()
    ctx.moveTo(c - 10 * dpr, c); ctx.lineTo(c + 10 * dpr, c)
    ctx.moveTo(c, c - 10 * dpr); ctx.lineTo(c, c + 10 * dpr)
    ctx.stroke()
  }, [active, quad, source, scale])

  const toSource = (e: PointerEvent<SVGSVGElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: Math.min(source.width, Math.max(0, ((e.clientX - rect.left) / rect.width) * source.width)),
      y: Math.min(source.height, Math.max(0, ((e.clientY - rect.top) / rect.height) * source.height)),
    }
  }

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = toSource(e)
    let nearest = -1
    let best = HANDLE_HIT / scale
    quad.forEach((q, i) => {
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < best) { best = d; nearest = i }
    })
    if (nearest < 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(nearest)
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    if (active === null) return
    const next = [...quad] as Quad
    next[active] = toSource(e)
    onChange(next)
  }

  const endDrag = () => setActive(null)

  const u = scale ? 1 / scale : 1 // 1 px de pantalla en unidades de la imagen
  const poly = quad.map((p) => `${p.x},${p.y}`).join(' ')
  const W = source.width
  const H = source.height
  // La lupa se coloca en la esquina superior opuesta al dedo
  const fingerOnLeft = active !== null && quad[active].x < W / 2

  return (
    <div ref={stageRef} className="stage-inner">
      {dispW > 0 && (
        <div className="crop" style={{ width: dispW, height: dispH }}>
          <canvas ref={previewRef} style={{ width: dispW, height: dispH }} />
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <path
              d={`M0 0H${W}V${H}H0Z M${quad.map((p) => `${p.x} ${p.y}`).join(' L')} Z`}
              fill="rgba(0,0,0,0.42)"
              fillRule="evenodd"
            />
            <polygon points={poly} fill="none" stroke="var(--tint)" strokeWidth={2 * u} strokeLinejoin="round" />
            {quad.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={(active === i ? 13 : 10) * u}
                fill="#fff"
                stroke="var(--tint)"
                strokeWidth={2 * u}
                style={{ transition: 'r 0.15s' }}
              />
            ))}
          </svg>
          {active !== null && (
            <canvas
              ref={loupeRef}
              className="loupe"
              style={{ width: LOUPE_SIZE, height: LOUPE_SIZE, [fingerOnLeft ? 'right' : 'left']: 8 }}
            />
          )}
        </div>
      )}
    </div>
  )
}
