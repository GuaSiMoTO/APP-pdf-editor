import { describe, expect, it } from 'vitest'
import { range, toggled } from '../lib/sets'
import { actionLabel, defaultRanges, groupIndex, outputFileName, splitPlan } from './splitPlan'

describe('splitPlan', () => {
  it('extraer: un solo archivo con las páginas seleccionadas en orden', () => {
    expect(splitPlan('select', new Set([4, 0, 2]), '', 5)).toEqual({ groups: [[0, 2, 4]] })
    expect(splitPlan('select', new Set(), '', 5)).toEqual({ groups: [] })
  })

  it('cada página: un archivo por página', () => {
    expect(splitPlan('each', new Set(), '', 3)).toEqual({ groups: [[0], [1], [2]] })
  })

  it('por rangos: grupos o el mensaje de error', () => {
    expect(splitPlan('ranges', new Set(), '1-2, 3', 3)).toEqual({ groups: [[0, 1], [2]] })
    expect(splitPlan('ranges', new Set(), '9', 3)).toEqual({ groups: [], error: 'El documento tiene 3 páginas' })
  })
})

describe('defaultRanges', () => {
  it('parte el documento en dos mitades', () => {
    expect(defaultRanges(1)).toBe('1')
    expect(defaultRanges(5)).toBe('1-3, 4-5')
    expect(defaultRanges(4)).toBe('1-2, 3-4')
  })
})

describe('groupIndex', () => {
  it('solo colorea en el modo rangos', () => {
    expect([...groupIndex('ranges', [[0, 1], [3]])]).toEqual([[0, 0], [1, 0], [3, 1]])
    expect(groupIndex('select', [[0, 1]]).size).toBe(0)
  })
})

describe('nombres y textos', () => {
  it('outputFileName', () => {
    expect(outputFileName('Informe', 'select', [0, 2])).toBe('Informe extracto.pdf')
    expect(outputFileName('Informe', 'ranges', [0, 1, 2])).toBe('Informe p1-3.pdf')
    expect(outputFileName('Informe', 'each', [4])).toBe('Informe p5.pdf')
  })

  it('actionLabel', () => {
    expect(actionLabel('select', 0, 0)).toBe('Selecciona páginas')
    expect(actionLabel('select', 2, 1)).toBe('Extraer 2 páginas')
    expect(actionLabel('ranges', 0, 0)).toBe('Dividir')
    expect(actionLabel('each', 0, 1)).toBe('Crear 1 archivo')
    expect(actionLabel('each', 0, 3)).toBe('Crear 3 archivos')
  })
})

describe('sets', () => {
  it('toggled añade y quita sin mutar el original', () => {
    const s = new Set([1])
    expect([...toggled(s, 2)]).toEqual([1, 2])
    expect([...toggled(s, 1)]).toEqual([])
    expect([...s]).toEqual([1])
  })

  it('range', () => {
    expect([...range(3)]).toEqual([0, 1, 2])
  })
})
