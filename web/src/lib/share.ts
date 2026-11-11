/** ¿Puede el sistema compartir este archivo? (en iOS abre la hoja de compartir:
 *  Guardar en Archivos, AirDrop, Mail...). */
export function canShareFile(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** Debe llamarse directamente desde un gesto del usuario (Safari lo exige). */
export async function shareFile(file: File): Promise<void> {
  try {
    await navigator.share({ files: [file], title: file.name })
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
