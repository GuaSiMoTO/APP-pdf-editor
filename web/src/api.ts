import { useEffect, useState } from 'react'

// Cliente del backend. Las rutas son relativas (/api/...): en desarrollo Vite hace de proxy
// hacia http://localhost:8000; en producción FastAPI sirve el frontend y la API en el mismo origen.

export type ServerStatus = 'checking' | 'online' | 'offline'

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>('checking')
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/health', { signal: ctrl.signal })
      .then((r) => setStatus(r.ok ? 'online' : 'offline'))
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus('offline')
      })
    return () => ctrl.abort()
  }, [])
  return status
}

/** Envía archivos a una herramienta del servidor y devuelve el resultado como Blob. */
export async function runServerTool(
  tool: string,
  files: File[],
  options: Record<string, string> = {},
): Promise<Blob> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  for (const [k, v] of Object.entries(options)) form.append(k, v)
  const res = await fetch(`/api/tools/${tool}`, { method: 'POST', body: form })
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new Error(detail?.detail ?? `Error ${res.status}`)
  }
  return res.blob()
}
