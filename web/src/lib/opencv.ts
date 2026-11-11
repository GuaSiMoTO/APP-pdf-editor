// Carga diferida de OpenCV.js (~13 MB). Solo se importa al abrir el escáner y se
// reutiliza la misma instancia durante toda la sesión.
import type * as OpenCV from '@techstark/opencv-js'

export type Cv = typeof OpenCV

let loading: Promise<Cv> | null = null

export function loadOpenCv(): Promise<Cv> {
  loading ??= (async () => {
    const mod = (await import('@techstark/opencv-js')) as { default?: unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cv: any = mod.default ?? mod
    // v4.11+: el export es una Promise; versiones antiguas usan onRuntimeInitialized.
    if (cv instanceof Promise) return (await cv) as Cv
    if (cv.Mat) return cv as Cv
    await new Promise<void>((resolve) => {
      cv.onRuntimeInitialized = () => resolve()
    })
    return cv as Cv
  })().catch((err) => {
    loading = null
    throw err
  })
  return loading
}
