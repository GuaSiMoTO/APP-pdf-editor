import { zipSync } from 'fflate'

/** ¿Puede el sistema compartir estos archivos? (en iOS abre la hoja de compartir:
 *  Guardar en Archivos, AirDrop, Mail...). */
export function canShareFiles(files: File[]): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files })
}

/** Debe llamarse directamente desde un gesto del usuario (Safari lo exige). */
export async function shareFiles(files: File[]): Promise<void> {
  try {
    await navigator.share({ files, title: files.length === 1 ? files[0].name : undefined })
  } catch (err) {
    if ((err as DOMException).name !== 'AbortError') throw err
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Empaqueta varios archivos en un ZIP sin recomprimir (los PDF ya van comprimidos). */
export async function zipFiles(files: File[], zipName: string): Promise<File> {
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer())
  const zipped = zipSync(entries, { level: 0 })
  return new File([zipped.slice().buffer], zipName, { type: 'application/zip' })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function pagesLabel(n: number): string {
  return `${n} ${n === 1 ? 'página' : 'páginas'}`
}
