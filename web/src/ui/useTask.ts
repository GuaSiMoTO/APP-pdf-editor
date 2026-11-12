import { useRef, useState } from 'react'
import { userMessage } from '../lib/errors'

export interface TaskOptions {
  /** Muestra "Cancelar" en el HUD; la tarea recibe la señal y debe respetarla. */
  cancellable?: boolean
}

const isAbort = (err: unknown) => (err as Error)?.name === 'AbortError'

/** Ejecuta tareas asíncronas mostrando el HUD (`busy`) y avisando de los errores:
 *  los `UserError` muestran su mensaje; cualquier otro se registra y se muestra uno genérico.
 *  Una cancelación del usuario no muestra ningún aviso. */
export function useTask() {
  const [busy, setBusy] = useState<string | null>(null)
  const [cancellable, setCancellable] = useState(false)
  const controller = useRef<AbortController | null>(null)

  const run = async (label: string, task: (signal: AbortSignal) => Promise<void>, options: TaskOptions = {}) => {
    const ctrl = new AbortController()
    controller.current = ctrl
    setBusy(label)
    setCancellable(!!options.cancellable)
    try {
      // Deja pintar el HUD antes de trabajo síncrono pesado
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      await task(ctrl.signal)
    } catch (err) {
      if (ctrl.signal.aborted && isAbort(err)) return
      console.error(err)
      alert(userMessage(err))
    } finally {
      if (controller.current === ctrl) controller.current = null
      setBusy(null)
      setCancellable(false)
    }
  }

  const cancel = () => controller.current?.abort()

  return { busy, run, cancel: cancellable ? cancel : undefined }
}
