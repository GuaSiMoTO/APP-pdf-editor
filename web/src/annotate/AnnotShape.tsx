import {
  bounds, HIGHLIGHT_OPACITY, markStrokes, markWidth, textBaselines, textLines, type Annot, type InkAnnot,
} from '../lib/annotations'

/** Dibujo SVG de una anotación (misma geometría que el PDF; ver lib/annotations.ts). */
export function AnnotShape({ a }: { a: Annot }) {
  switch (a.kind) {
    case 'text': {
      const lines = textLines(a)
      return (
        <text fontSize={a.size} fill={a.color} fontFamily="Helvetica, Arial, sans-serif" style={{ whiteSpace: 'pre' }}>
          {textBaselines(a).map(([x, y], i) => <tspan key={i} x={x} y={y}>{lines[i]}</tspan>)}
        </text>
      )
    }
    case 'rect':
      return a.style === 'highlight'
        ? <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} fillOpacity={HIGHLIGHT_OPACITY} style={{ mixBlendMode: 'multiply' }} />
        : <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} stroke="rgba(0,0,0,0.12)" strokeWidth={0.5} />
    case 'mark':
      return (
        <g fill="none" stroke={a.color} strokeWidth={markWidth(a)} strokeLinecap="round" strokeLinejoin="round">
          {markStrokes(a).map((s, i) => <polyline key={i} points={s.map((p) => p.join(',')).join(' ')} />)}
        </g>
      )
    case 'ink':
      return <InkShape a={a} />
  }
}

function InkShape({ a }: { a: InkAnnot }) {
  if (a.points.length === 1) return <circle cx={a.points[0][0]} cy={a.points[0][1]} r={a.width / 2} fill={a.color} />
  return <polyline points={a.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={a.color}
    strokeWidth={a.width} strokeLinecap="round" strokeLinejoin="round" />
}

/** Área táctil invisible algo mayor que la anotación. */
export function HitBox({ a, pad }: { a: Annot; pad: number }) {
  const b = bounds(a)
  return <rect x={b.x - pad} y={b.y - pad} width={b.w + pad * 2} height={b.h + pad * 2} fill="transparent" />
}

/** Marco discontinuo de la selección y tirador de tamaño (salvo trazos a mano). */
export function SelectionFrame({ a, k }: { a: Annot; k: number }) {
  const b = bounds(a)
  const hx = b.x + b.w + 3 / k
  const hy = b.y + b.h + 3 / k
  return (
    <g className="selection">
      <rect x={b.x - 3 / k} y={b.y - 3 / k} width={b.w + 6 / k} height={b.h + 6 / k}
        fill="none" stroke="var(--tint)" strokeWidth={1.5} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
      {a.kind !== 'ink' && (
        <g data-handle>
          <circle cx={hx} cy={hy} r={20 / k} fill="transparent" />
          <circle cx={hx} cy={hy} r={8 / k} fill="#fff" stroke="var(--tint)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </g>
  )
}
