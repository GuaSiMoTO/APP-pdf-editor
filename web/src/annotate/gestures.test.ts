import { describe, expect, it } from 'vitest'
import type { Annot, InkAnnot, MarkAnnot, RectAnnot, TextAnnot } from '../lib/annotations'
import { dragged, extendDraft, isDrawingTool, keepDraft, newDraft, pillTop, placeAt, type ToolStyle } from './gestures'

const STYLE: ToolStyle = { color: '#1c1c1e', textSize: 12, penWidth: 2, highlightColor: '#ffd60a' }
const K = 1.5 // px por punto

describe('borradores', () => {
  it('pen crea un trazo; highlight y cover, rectángulos', () => {
    expect(newDraft('pen', [10, 20], 0, STYLE, 'a')).toEqual({ id: 'a', page: 0, kind: 'ink', points: [[10, 20]], width: 2, color: '#1c1c1e' })
    expect(newDraft('highlight', [10, 20], 1, STYLE, 'b')).toMatchObject({ kind: 'rect', style: 'highlight', color: '#ffd60a', page: 1 })
    expect(newDraft('cover', [10, 20], 0, STYLE, 'c')).toMatchObject({ kind: 'rect', style: 'cover', color: '#ffffff' })
  })

  it('el rectángulo va del punto inicial al actual en cualquier dirección', () => {
    const d = newDraft('cover', [50, 50], 0, STYLE, 'r')
    expect(extendDraft(d, [50, 50], [20, 80], K)).toMatchObject({ x: 20, y: 50, w: 30, h: 30 })
  })

  it('el trazo ignora movimientos de menos de 2 px', () => {
    const d = newDraft('pen', [0, 0], 0, STYLE, 'i') as InkAnnot
    expect((extendDraft(d, [0, 0], [1, 0], K) as InkAnnot).points).toHaveLength(1) // 1,5 px
    expect((extendDraft(d, [0, 0], [2, 0], K) as InkAnnot).points).toHaveLength(2) // 3 px
  })

  it('descarta rectángulos diminutos (toques accidentales) pero conserva los trazos', () => {
    const r = (w: number, h: number): RectAnnot => ({ id: 'r', page: 0, kind: 'rect', x: 0, y: 0, w, h, style: 'cover', color: '#fff' })
    expect(keepDraft(r(3, 30), K)).toBe(false) // 4,5 px de ancho
    expect(keepDraft(r(5, 5), K)).toBe(true) // 7,5 px
    expect(keepDraft(newDraft('pen', [0, 0], 0, STYLE, 'i'), K)).toBe(true)
  })
})

describe('arrastrar', () => {
  const rect: Annot = { id: 'r', page: 0, kind: 'rect', x: 10, y: 10, w: 20, h: 20, style: 'cover', color: '#fff' }

  it('mover no deja salir de la página', () => {
    expect(dragged('move', rect, 5, 5, 100, 100)).toMatchObject({ x: 15, y: 15 })
    expect(dragged('move', rect, -50, 500, 100, 100)).toMatchObject({ x: 0, y: 80 })
  })

  it('redimensionar desde la esquina', () => {
    expect(dragged('resize', rect, 10, 5, 100, 100)).toMatchObject({ w: 30, h: 25 })
  })
})

describe('colocar con un toque', () => {
  const now = new Date(2026, 10, 12)

  it('texto: pide el contenido, con la primera línea a la altura del dedo', () => {
    expect(placeAt('text', [100, 200], 0, 595, STYLE, 'x', now)).toEqual({ type: 'ask-text', x: 100, y: 200 - 12 * 0.6 })
  })

  it('fecha: crea un texto con la fecha en formato español', () => {
    const p = placeAt('date', [100, 200], 2, 595, STYLE, 'x', now)
    expect(p?.type).toBe('create')
    expect((p as { annot: TextAnnot }).annot).toMatchObject({ kind: 'text', text: '12/11/2026', page: 2, size: 12 })
  })

  it('✓ y ✗ quedan centradas en el dedo y escalan con la página', () => {
    const a4 = (placeAt('check', [100, 200], 0, 595, STYLE, 'x', now) as { annot: MarkAnnot }).annot
    expect(a4).toMatchObject({ symbol: 'check', s: 16, x: 92, y: 192 })
    const big = (placeAt('cross', [100, 200], 0, 1190, STYLE, 'x', now) as { annot: MarkAnnot }).annot
    expect(big.s).toBe(32)
  })

  it('las herramientas de dibujo no colocan nada con un toque', () => {
    expect(placeAt('pen', [1, 1], 0, 595, STYLE, 'x', now)).toBeNull()
    expect(placeAt('select', [1, 1], 0, 595, STYLE, 'x', now)).toBeNull()
  })
})

describe('otros', () => {
  it('isDrawingTool', () => {
    expect(['highlight', 'cover', 'pen'].every((t) => isDrawingTool(t as never))).toBe(true)
    expect(isDrawingTool('text')).toBe(false)
  })

  it('el menú va encima si cabe y debajo si no', () => {
    expect(pillTop({ y: 100, h: 10 }, 1)).toBe(54)
    expect(pillTop({ y: 20, h: 10 }, 1)).toBe(40)
  })
})
