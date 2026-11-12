import { describe, expect, it } from 'vitest'
import { fileNameFrom, serverErrorMessage } from './api'

describe('fileNameFrom', () => {
  it('lee filename* con acentos (formato de Starlette)', () => {
    expect(fileNameFrom("attachment; filename*=utf-8''Inform%C3%A9%20protegido.pdf", 'x.pdf')).toBe('Informé protegido.pdf')
  })
  it('lee filename simple', () => {
    expect(fileNameFrom('attachment; filename="a b.pdf"', 'x.pdf')).toBe('a b.pdf')
  })
  it('usa el nombre por defecto si falta o está mal codificado', () => {
    expect(fileNameFrom(null, 'x.pdf')).toBe('x.pdf')
    expect(fileNameFrom("attachment; filename*=utf-8''%E0%A4%A", 'x.pdf')).toBe('x.pdf')
  })
})

describe('serverErrorMessage', () => {
  it('muestra el detail de texto del servidor', () => {
    expect(serverErrorMessage({ detail: 'Contraseña incorrecta.' }, 422)).toBe('Contraseña incorrecta.')
  })
  it('no muestra los detalles de validación de FastAPI (lista de objetos)', () => {
    const msg = serverErrorMessage({ detail: [{ loc: ['body', 'file'], msg: 'Field required' }] }, 422)
    expect(msg).not.toMatch(/object|Field required/)
    expect(msg).toMatch(/rechazado/)
  })
  it('mensajes por estado cuando no hay detail', () => {
    expect(serverErrorMessage(null, 413)).toMatch(/demasiado grande/)
    expect(serverErrorMessage(null, 500)).toMatch(/no ha podido procesar/)
  })
})
