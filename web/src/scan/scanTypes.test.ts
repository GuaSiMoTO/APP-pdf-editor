import { describe, expect, it } from 'vitest'
import { safeFileName } from '../lib/pdfOps'
import { defaultScanName } from './scanTypes'

describe('defaultScanName', () => {
  it('fecha y hora con ceros a la izquierda', () => {
    expect(defaultScanName(new Date(2026, 0, 5, 9, 7))).toBe('Escaneo 2026-01-05 09.07')
  })

  it('es un nombre de archivo válido tal cual', () => {
    const name = defaultScanName(new Date(2026, 10, 12, 23, 59))
    expect(safeFileName(name)).toBe(name)
  })
})

describe('safeFileName', () => {
  it('sustituye los caracteres no permitidos en nombres de archivo', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j')
  })
  it('usa un nombre por defecto si queda vacío', () => {
    expect(safeFileName('   ')).toBe('Documento')
  })
})
