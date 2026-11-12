import type { ScanFilter } from './detect'
import type { Quad } from './geometry'

/** Página ya escaneada. Para poder re-editarla se guarda la foto original y el recorte.
 *  La foto va como JPEG (1–2 MB), no como canvas (~36 MB a 3000 px): con muchas páginas
 *  un canvas por página agota la memoria de Safari en iOS. */
export interface ScannedPage {
  id: string
  source: Blob
  quad: Quad
  rotation: number
  filter: ScanFilter
  jpeg: Blob
  url: string
}

/** Página en edición (recorte → filtro). Solo hay una a la vez en memoria como canvas. */
export interface Draft {
  source: HTMLCanvasElement
  /** JPEG de la foto si ya existía (re-edición): evita volver a comprimirla. */
  sourceJpeg?: Blob
  quad: Quad
  rotation: number
  filter: ScanFilter
  editingId?: string
}

/** "Escaneo 2026-11-12 09.05" */
export function defaultScanName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Escaneo ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}.${pad(now.getMinutes())}`
}
