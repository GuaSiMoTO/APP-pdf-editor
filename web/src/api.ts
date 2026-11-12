import { useEffect, useState } from 'react'
import { UserError } from './lib/errors'

// Cliente del backend. Las rutas son relativas (/api/...): en desarrollo Vite hace de proxy
// hacia http://localhost:8000; en producción FastAPI sirve el frontend y la API en el mismo origen.

export interface ServerStatus {
  state: 'checking' | 'online' | 'offline'
  /** Herramientas del servidor utilizables ahora (fuera de Docker faltan programas). */
  tools: Record<string, boolean>
}

/** Sin respuesta en este tiempo, el PC se da por no disponible (si está apagado, la
 *  conexión TCP puede tardar más de un minuto en fallar). */
const HEALTH_TIMEOUT_MS = 4000
/** Tiempo máximo por herramienta: algo más que el límite del servidor (server/app/tools.py). */
const TOOL_TIMEOUT_MS: Record<string, number> = { ocr: 16 * 60_000 }
const DEFAULT_TOOL_TIMEOUT_MS = 6 * 60_000

/** AbortSignal que salta por tiempo o por la señal externa (cancelación del usuario).
 *  Implementado a mano: AbortSignal.any/timeout no existen en todas las versiones de iOS. */
function withTimeout(ms: number, external?: AbortSignal): { signal: AbortSignal; timedOut: () => boolean; dispose: () => void } {
  const ctrl = new AbortController()
  let expired = false
  const timer = setTimeout(() => {
    expired = true
    ctrl.abort()
  }, ms)
  const onExternal = () => ctrl.abort()
  external?.addEventListener('abort', onExternal)
  if (external?.aborted) ctrl.abort()
  return {
    signal: ctrl.signal,
    timedOut: () => expired,
    dispose: () => {
      clearTimeout(timer)
      external?.removeEventListener('abort', onExternal)
    },
  }
}

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({ state: 'checking', tools: {} })
  useEffect(() => {
    const t = withTimeout(HEALTH_TIMEOUT_MS)
    let unmounted = false
    fetch('/api/health', { signal: t.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const body = (await r.json()) as { tools?: Record<string, boolean> }
        if (!unmounted) setStatus({ state: 'online', tools: body.tools ?? {} })
      })
      .catch(() => {
        if (!unmounted) setStatus({ state: 'offline', tools: {} })
      })
      .finally(t.dispose)
    return () => {
      unmounted = true
      t.dispose()
    }
  }, [])
  return status
}

/** Nombre del archivo desde Content-Disposition (admite filename*=utf-8''...). */
export function fileNameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback
  const star = header.match(/filename\*=(?:utf-8|UTF-8)''([^;]+)/)
  if (star) {
    try {
      return decodeURIComponent(star[1])
    } catch {
      return fallback
    }
  }
  const plain = header.match(/filename="?([^";]+)"?/)
  return plain ? plain[1] : fallback
}

/** Mensaje de error del servidor: solo se muestra si es un texto (FastAPI devuelve
 *  una lista de objetos en los errores de validación). */
export function serverErrorMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (status === 413) return 'El archivo es demasiado grande.'
  if (status >= 500) return 'El PC no ha podido procesar el archivo. Inténtalo de nuevo.'
  return `El PC ha rechazado la petición (error ${status}).`
}

export interface ServerResult {
  file: File
  originalSize: number
}

/** Envía un archivo a una herramienta del servidor y devuelve el resultado.
 *  `signal` permite cancelar desde la interfaz; además hay un tiempo máximo por herramienta. */
export async function runServerTool(
  tool: string,
  file: File,
  options: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<ServerResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))
  const t = withTimeout(TOOL_TIMEOUT_MS[tool] ?? DEFAULT_TOOL_TIMEOUT_MS, signal)
  try {
    let res: Response
    try {
      res = await fetch(`/api/tools/${encodeURIComponent(tool)}`, { method: 'POST', body: form, signal: t.signal })
    } catch (err) {
      if (t.timedOut()) throw new UserError('El PC está tardando demasiado. Prueba con un archivo más pequeño.', { cause: err })
      if (signal?.aborted) throw err // cancelado por el usuario (AbortError)
      throw new UserError('No hay conexión con el PC. Comprueba que el servidor está en marcha y que estás en la misma red.', { cause: err })
    }
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null)
      throw new UserError(serverErrorMessage(body, res.status))
    }
    const blob = await res.blob()
    return {
      file: new File([blob], fileNameFrom(res.headers.get('Content-Disposition'), file.name), { type: blob.type }),
      originalSize: Number(res.headers.get('X-Original-Size')) || file.size,
    }
  } finally {
    t.dispose()
  }
}
