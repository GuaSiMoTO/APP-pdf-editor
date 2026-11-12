import { useEffect, useState } from 'react'

// Cliente del backend. Las rutas son relativas (/api/...): en desarrollo Vite hace de proxy
// hacia http://localhost:8000; en producción FastAPI sirve el frontend y la API en el mismo origen.

export interface ServerStatus {
  state: 'checking' | 'online' | 'offline'
  /** Herramientas del servidor utilizables ahora (fuera de Docker faltan programas). */
  tools: Record<string, boolean>
}

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>({ state: 'checking', tools: {} })
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/health', { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error()
        const body = (await r.json()) as { tools?: Record<string, boolean> }
        setStatus({ state: 'online', tools: body.tools ?? {} })
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus({ state: 'offline', tools: {} })
      })
    return () => ctrl.abort()
  }, [])
  return status
}

/** Nombre del archivo desde Content-Disposition (admite filename*=utf-8''...). */
function fileNameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback
  const star = header.match(/filename\*=(?:utf-8|UTF-8)''([^;]+)/)
  if (star) return decodeURIComponent(star[1])
  const plain = header.match(/filename="?([^";]+)"?/)
  return plain ? plain[1] : fallback
}

export interface ServerResult {
  file: File
  originalSize: number
}

/** Envía un archivo a una herramienta del servidor y devuelve el resultado. */
export async function runServerTool(tool: string, file: File, options: Record<string, string> = {}): Promise<ServerResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('options', JSON.stringify(options))
  let res: Response
  try {
    res = await fetch(`/api/tools/${tool}`, { method: 'POST', body: form })
  } catch {
    throw new Error('No hay conexión con el PC. Comprueba que el servidor está en marcha y que estás en la misma red.')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? `Error del servidor (${res.status})`)
  }
  const blob = await res.blob()
  const name = fileNameFrom(res.headers.get('Content-Disposition'), file.name)
  return {
    file: new File([blob], name, { type: blob.type }),
    originalSize: Number(res.headers.get('X-Original-Size')) || file.size,
  }
}
