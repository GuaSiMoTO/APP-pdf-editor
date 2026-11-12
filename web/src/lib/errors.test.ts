import { describe, expect, it } from 'vitest'
import { UserError, userMessage } from './errors'
import { buildPdfs, parseRanges } from './pdfOps'

describe('userMessage', () => {
  it('muestra el mensaje de un UserError', () => {
    expect(userMessage(new UserError('Contraseña incorrecta.'))).toBe('Contraseña incorrecta.')
  })

  it('oculta los detalles técnicos de cualquier otro error', () => {
    const msg = userMessage(new TypeError("Cannot read properties of undefined (reading 'x')"))
    expect(msg).not.toMatch(/undefined|TypeError/)
    expect(msg).toMatch(/No se ha podido completar/)
  })

  it('también con valores que no son errores', () => {
    expect(userMessage('fallo')).toMatch(/No se ha podido completar/)
  })
})

describe('los errores esperados llegan como UserError', () => {
  it('rangos inválidos', () => {
    expect(() => parseRanges('9', 3)).toThrow(UserError)
  })

  it('un archivo que no es PDF', async () => {
    const notPdf = new TextEncoder().encode('esto no es un pdf').buffer as ArrayBuffer
    const err = await buildPdfs([notPdf], [[]]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UserError)
    expect((err as Error).message).toMatch(/no es un PDF válido/)
    expect((err as Error).cause).toBeDefined() // el error original se conserva para el log
  })
})
