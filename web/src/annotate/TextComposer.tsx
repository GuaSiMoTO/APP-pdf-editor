import { useState } from 'react'
import { ColorDots, Segmented } from '../ui/controls'

interface Props<S extends string> {
  initialText: string
  initialSize: number
  initialColor: string
  sizes: Record<S, number>
  colors: { color: string; label: string }[]
  onCancel: () => void
  onDone: (text: string, size: number, color: string) => void
}

/** Editor de texto a pantalla completa (así el teclado de iOS no tapa nada). */
export function TextComposer<S extends string>({ initialText, initialSize, initialColor, sizes, colors, onCancel, onDone }: Props<S>) {
  const [text, setText] = useState(initialText)
  const [size, setSize] = useState(initialSize)
  const [color, setColor] = useState(initialColor)
  const keys = Object.keys(sizes) as S[]
  // Tamaño seleccionado: el predefinido más cercano (el texto pudo redimensionarse a mano)
  const sizeKey = keys.reduce((best, k) => (Math.abs(sizes[k] - size) < Math.abs(sizes[best] - size) ? k : best), keys[0])

  return (
    <div className="pad-screen fade-in">
      <header className="navbar">
        <div className="navbar-inner">
          <div className="navbar-side">
            <button type="button" className="bar-button" onClick={onCancel}>Cancelar</button>
          </div>
          <div className="navbar-title">Texto</div>
          <div className="navbar-side end">
            <button type="button" className="bar-button strong" onClick={() => onDone(text.replace(/\s+$/, ''), size, color)}>Hecho</button>
          </div>
        </div>
      </header>
      <div className="composer">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe aquí…"
          style={{ color, fontSize: Math.max(17, size * 1.4) }}
          rows={4}
        />
        <div className="composer-options">
          <ColorDots value={color} colors={colors} onChange={setColor} />
          <Segmented value={sizeKey} onChange={(k) => setSize(sizes[k])}
            options={keys.map((k, i) => ({ id: k, label: ['Pequeño', 'Mediano', 'Grande'][i] ?? k }))} />
        </div>
      </div>
    </div>
  )
}
