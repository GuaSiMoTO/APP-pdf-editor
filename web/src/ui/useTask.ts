import { useState } from 'react'

/** Ejecuta tareas asíncronas mostrando el HUD (`busy`) y avisando de los errores. */
export function useTask() {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label)
    try {
      // Deja pintar el HUD antes de trabajo síncrono pesado
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      await task()
    } catch (err) {
      console.error(err)
      alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}
