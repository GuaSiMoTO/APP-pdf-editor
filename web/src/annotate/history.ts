import { useState } from 'react'

/** Pasos de deshacer que se guardan como máximo (cada uno es una copia de la lista). */
export const HISTORY_LIMIT = 50

/** Historial con `current` añadido, conservando como mucho `limit` pasos. */
export function pushSnapshot<T>(history: readonly T[], current: T, limit = HISTORY_LIMIT): T[] {
  return [...history.slice(-(limit - 1)), current]
}

/** Deshace un paso: el estado a restaurar y el historial restante (null si no hay nada). */
export function popSnapshot<T>(history: readonly T[]): { restored: T; history: T[] } | null {
  if (!history.length) return null
  return { restored: history[history.length - 1], history: history.slice(0, -1) }
}

/** Estado con deshacer. `snapshot()` guarda el estado actual antes de un cambio. */
export function useUndoable<T>(initial: T) {
  const [value, setValue] = useState<T>(initial)
  const [history, setHistory] = useState<T[]>([])

  return {
    value,
    set: setValue,
    canUndo: history.length > 0,
    snapshot: () => setHistory((h) => pushSnapshot(h, value)),
    /** Devuelve true si se ha deshecho algo. */
    undo: (): boolean => {
      const step = popSnapshot(history)
      if (!step) return false
      setHistory(step.history)
      setValue(step.restored)
      return true
    },
    reset: (next: T) => {
      setValue(next)
      setHistory([])
    },
  }
}
