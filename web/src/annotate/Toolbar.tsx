import {
  CalendarDays, Check, FileUp, Highlighter, MousePointer2, PenLine, RectangleHorizontal, Type, Undo2, X,
  type LucideIcon,
} from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { ColorDots, Segmented } from '../ui/controls'
import type { Tool, ToolStyle } from './gestures'
import { HIGHLIGHTS, INKS, PEN_WIDTHS, TEXT_SIZES } from './palette'

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'Mover', icon: MousePointer2 },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'date', label: 'Fecha', icon: CalendarDays },
  { id: 'check', label: 'Marca', icon: Check },
  { id: 'cross', label: 'Cruz', icon: X },
  { id: 'highlight', label: 'Resaltar', icon: Highlighter },
  { id: 'cover', label: 'Tapar', icon: RectangleHorizontal },
  { id: 'pen', label: 'Dibujar', icon: PenLine },
]

/** Clave de un valor en una tabla de tamaños (o 'M' si no coincide). */
function keyOf<K extends string>(table: Record<K, number>, value: number): K {
  return (Object.keys(table) as K[]).find((k) => table[k] === value) ?? ('M' as K)
}

const HINTS: Partial<Record<Tool, string>> = {
  text: 'Toca la página', date: 'Toca la página', check: 'Toca la página', cross: 'Toca la página',
  highlight: 'Arrastra sobre la página', pen: 'Arrastra sobre la página',
}

/** Opciones de la herramienta activa (colores, tamaños, avisos). */
function ToolOptions({ tool, style, setStyle, hasAnnots }: {
  tool: Tool
  style: ToolStyle
  setStyle: Dispatch<SetStateAction<ToolStyle>>
  hasAnnots: boolean
}) {
  const ink = <ColorDots value={style.color} colors={INKS} onChange={(color) => setStyle((s) => ({ ...s, color }))} />
  return (
    <div className="tool-options">
      {tool === 'select' && (
        <span className="hint">{hasAnnots ? 'Toca un elemento para moverlo, cambiar su tamaño o eliminarlo' : 'Elige una herramienta'}</span>
      )}
      {(tool === 'text' || tool === 'date') && (
        <>
          {ink}
          <Segmented value={keyOf(TEXT_SIZES, style.textSize)} onChange={(k) => setStyle((s) => ({ ...s, textSize: TEXT_SIZES[k] }))}
            options={[{ id: 'S', label: 'A' }, { id: 'M', label: 'A+' }, { id: 'L', label: 'A++' }]} />
        </>
      )}
      {(tool === 'check' || tool === 'cross') && ink}
      {tool === 'pen' && (
        <>
          {ink}
          <Segmented value={keyOf(PEN_WIDTHS, style.penWidth)} onChange={(k) => setStyle((s) => ({ ...s, penWidth: PEN_WIDTHS[k] }))}
            options={[{ id: 'S', label: 'Fino' }, { id: 'M', label: 'Medio' }, { id: 'L', label: 'Grueso' }]} />
        </>
      )}
      {tool === 'highlight' && (
        <ColorDots value={style.highlightColor} colors={HIGHLIGHTS} onChange={(highlightColor) => setStyle((s) => ({ ...s, highlightColor }))} />
      )}
      {tool === 'cover' && <span className="hint">Tapa con blanco. Ojo: el contenido sigue dentro del PDF.</span>}
      {HINTS[tool] && <span className="hint grow">{HINTS[tool]}</span>}
    </div>
  )
}

interface ToolbarProps {
  tool: Tool
  onTool: (t: Tool) => void
  style: ToolStyle
  setStyle: Dispatch<SetStateAction<ToolStyle>>
  hasAnnots: boolean
  canUndo: boolean
  onUndo: () => void
  onOpen: () => void
}

/** Barra inferior del editor: opciones de la herramienta + fila de herramientas. */
export function Toolbar({ tool, onTool, style, setStyle, hasAnnots, canUndo, onUndo, onOpen }: ToolbarProps) {
  return (
    <footer className="toolbar annot-toolbar">
      <ToolOptions tool={tool} style={style} setStyle={setStyle} hasAnnots={hasAnnots} />
      <div className="tool-row">
        <button type="button" className="tool-btn" aria-label="Deshacer" disabled={!canUndo} onClick={onUndo}>
          <Undo2 size={22} />
        </button>
        <span className="tool-sep" />
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" className="tool-btn" aria-pressed={tool === id} onClick={() => onTool(id)}>
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
        <span className="tool-sep" />
        <button type="button" className="tool-btn" aria-label="Abrir otro PDF" onClick={onOpen}>
          <FileUp size={22} />
        </button>
      </div>
    </footer>
  )
}
