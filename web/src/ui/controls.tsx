// Controles de formulario estilo iOS para las listas de opciones.
import type { ReactNode } from 'react'

/** Fila de opción: etiqueta a la izquierda, control a la derecha (o debajo si `stacked`). */
export function OptionRow({ label, children, stacked }: { label: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={`row option-row${stacked ? ' stacked' : ''}`}>
      <span className="option-label">{label}</span>
      <div className="option-control">{children}</div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  )
}

export function Slider({ value, min, max, step, onChange, label, format }: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void; label: string; format: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="slider-wrap">
      <input type="range" className="slider" min={min} max={max} step={step} value={value} aria-label={label}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">{format(value)}</span>
    </div>
  )
}

export function ColorDots({ value, colors, onChange }: {
  value: string
  colors: { color: string; label: string }[]
  onChange: (c: string) => void
}) {
  return (
    <div className="ink-picker" role="radiogroup">
      {colors.map((c) => (
        <button key={c.color} type="button" role="radio" aria-checked={value === c.color} aria-label={c.label}
          className="ink-dot" style={{ background: c.color }} onClick={() => onChange(c.color)} />
      ))}
    </div>
  )
}
