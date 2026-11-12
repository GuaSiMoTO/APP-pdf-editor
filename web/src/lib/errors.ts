/** Error con un mensaje pensado para el usuario (en español, sin detalles técnicos).
 *  Cualquier otro error se considera un fallo técnico: se registra en consola y el
 *  usuario ve un mensaje genérico (ver ui/useTask.ts). */
export class UserError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'UserError'
  }
}

/** Mensaje apto para mostrar: el de un UserError o uno genérico para fallos técnicos. */
export function userMessage(err: unknown): string {
  if (err instanceof UserError) return err.message
  return 'No se ha podido completar la operación. Inténtalo de nuevo; si sigue fallando, prueba con otro archivo.'
}
