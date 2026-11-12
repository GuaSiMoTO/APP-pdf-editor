// Lógica pura de "Dividir PDF" (sin React), para poder probarla aparte.
import { parseRanges, rangeLabel } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'

export type SplitMode = 'select' | 'ranges' | 'each'

export interface SplitPlan {
  /** Páginas (0-based) de cada archivo de salida. */
  groups: number[][]
  /** Mensaje si los rangos escritos no son válidos. */
  error?: string
}

/** Rango propuesto al abrir: el documento partido en dos mitades. */
export function defaultRanges(pageCount: number): string {
  if (pageCount <= 1) return '1'
  const half = Math.ceil(pageCount / 2)
  return `1-${half}, ${half + 1}-${pageCount}`
}

/** Grupos de páginas que se generarán según el modo. */
export function splitPlan(mode: SplitMode, selected: ReadonlySet<number>, ranges: string, pageCount: number): SplitPlan {
  if (mode === 'select') return { groups: selected.size ? [[...selected].sort((a, b) => a - b)] : [] }
  if (mode === 'each') return { groups: Array.from({ length: pageCount }, (_, i) => [i]) }
  try {
    return { groups: parseRanges(ranges, pageCount) }
  } catch (err) {
    return { groups: [], error: (err as Error).message }
  }
}

/** Página → índice del archivo al que irá (para colorearlas en el modo rangos). */
export function groupIndex(mode: SplitMode, groups: number[][]): Map<number, number> {
  const m = new Map<number, number>()
  if (mode === 'ranges') groups.forEach((g, gi) => g.forEach((p) => m.set(p, gi)))
  return m
}

export function outputFileName(base: string, mode: SplitMode, group: number[]): string {
  return `${base} ${mode === 'select' ? 'extracto' : `p${rangeLabel(group)}`}.pdf`
}

export function actionLabel(mode: SplitMode, selectedCount: number, files: number): string {
  if (mode === 'select') return selectedCount ? `Extraer ${pagesLabel(selectedCount)}` : 'Selecciona páginas'
  return files ? `Crear ${files} ${files === 1 ? 'archivo' : 'archivos'}` : 'Dividir'
}
