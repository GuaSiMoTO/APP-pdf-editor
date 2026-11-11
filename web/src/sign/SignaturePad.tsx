import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { drawSegment, drawStroke, drawTail, MAX_WIDTH, nextWidth, strokesToPng, type Stroke } from './ink'

const INKS = [
  { color: '#1c1c1e', label: 'Negro' },
  { color: '#123f9c', label: 'Azul' },
]

interface Props {
  onCancel: () => void
  onDone: (png: { dataUrl: string; width: number; height: number }) => void
}

/** Pantalla completa para dibujar una firma con el dedo (o Apple Pencil). */
export function SignaturePad({ onCancel, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<{ stroke: Stroke; t: number } | null>(null)
  const [ink, setInk] = useState(INKS[0].color)
  const [count, setCount] = useState(0) // nº de trazos (para habilitar botones)

  const ctx = () => canvasRef.current!.getContext('2d')!

  // Ajusta el canvas al tamaño en pantalla (también al girar el iPhone) y repinta
  useEffect(() => {
    const canvas = canvasRef.current!
    const fit = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      const c = ctx()
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      strokesRef.current.forEach((s) => drawStroke(c, s))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
  const onPointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = pos(e)
    const stroke: Stroke = { color: ink, points: [{ ...p, w: MAX_WIDTH * 0.7 }] }
    currentRef.current = { stroke, t: e.timeStamp }
    drawSegment(ctx(), stroke, 0)
  }

  const onPointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const cur = currentRef.current
    if (!cur) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    const rect = e.currentTarget.getBoundingClientRect()
    for (const ev of events) {
      const pts = cur.stroke.points
      const last = pts[pts.length - 1]
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top
      const dist = Math.hypot(x - last.x, y - last.y)
      if (dist < 1.5) continue
      const dt = Math.max(1, ev.timeStamp - cur.t)
      cur.t = ev.timeStamp
      pts.push({ x, y, w: nextWidth(last.w, dist / dt, ev.pointerType === 'pen' ? ev.pressure : undefined) })
      drawSegment(ctx(), cur.stroke, pts.length - 1)
    }
  }

  const onPointerUp = () => {
    const cur = currentRef.current
    if (!cur) return
    drawTail(ctx(), cur.stroke)
    strokesRef.current.push(cur.stroke)
    currentRef.current = null
    setCount(strokesRef.current.length)
  }

  const clear = () => {
    strokesRef.current = []
    const canvas = canvasRef.current!
    const c = ctx()
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, canvas.width, canvas.height)
    c.restore()
    setCount(0)
  }

  const undo = () => {
    strokesRef.current.pop()
    const all = strokesRef.current
    clear()
    strokesRef.current = all
    all.forEach((s) => drawStroke(ctx(), s))
    setCount(all.length)
  }

  return (
    <div className="pad-screen fade-in">
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-side">
            <button type="button" className="bar-button" onClick={onCancel}>Cancelar</button>
          </div>
          <div className="navbar-title">Nueva firma</div>
          <div className="navbar-side end">
            <button type="button" className="bar-button strong" disabled={count === 0}
              onClick={() => onDone(strokesToPng(strokesRef.current))}>
              Hecho
            </button>
          </div>
        </div>
      </header>

      <div className="pad-paper">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="pad-baseline" aria-hidden="true">
          <span>×</span>
        </div>
        {count === 0 && <div className="pad-placeholder">Firma aquí</div>}
      </div>

      <footer className="toolbar">
        <div className="toolbar-inner">
          <div className="ink-picker" role="radiogroup" aria-label="Color de tinta">
            {INKS.map((i) => (
              <button key={i.color} type="button" role="radio" aria-checked={ink === i.color} aria-label={i.label}
                className="ink-dot" style={{ background: i.color }} onClick={() => setInk(i.color)} />
            ))}
          </div>
          <span style={{ flex: 1 }} />
          <button type="button" className="bar-button" disabled={count === 0} onClick={undo}>Deshacer</button>
          <button type="button" className="bar-button" disabled={count === 0} onClick={clear}>Borrar</button>
        </div>
      </footer>
    </div>
  )
}
