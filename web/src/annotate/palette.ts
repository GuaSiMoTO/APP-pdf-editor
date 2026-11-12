import type { ToolStyle } from './gestures'

/** Colores de tinta (texto, ✓/✗, dibujo) y de resaltado del editor. */
export const INKS = [
  { color: '#1c1c1e', label: 'Negro' }, { color: '#123f9c', label: 'Azul' },
  { color: '#d70015', label: 'Rojo' }, { color: '#248a3d', label: 'Verde' },
]
export const HIGHLIGHTS = [
  { color: '#ffd60a', label: 'Amarillo' }, { color: '#30d158', label: 'Verde' },
  { color: '#ff6482', label: 'Rosa' }, { color: '#64d2ff', label: 'Azul' },
]
/** Tamaños de texto y grosores de trazo, en puntos PDF. */
export const TEXT_SIZES = { S: 9, M: 12, L: 16 } as const
export const PEN_WIDTHS = { S: 1, M: 2, L: 4 } as const

export const DEFAULT_STYLE: ToolStyle = {
  color: INKS[0].color, textSize: TEXT_SIZES.M, penWidth: PEN_WIDTHS.M, highlightColor: HIGHLIGHTS[0].color,
}
