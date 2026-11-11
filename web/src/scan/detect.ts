// Detección de documento, corrección de perspectiva y filtros con OpenCV.js.
// Toda Mat creada debe liberarse con .delete(): OpenCV.js usa memoria WASM sin GC.

import type { Cv } from '../lib/opencv'
import { distance, orderQuad, type Point, type Quad } from './geometry'
import { createCanvas, downscale } from './image'

export type ScanFilter = 'color' | 'gray' | 'bw'

/** Lado mayor de la imagen usada para detectar (más rápido y menos ruido). */
const DETECT_SIDE = 800
/** Lado mayor máximo de la página resultante (~A4 a 300 ppp). */
const MAX_OUTPUT_SIDE = 2480
/** Área mínima del documento respecto a la foto. */
const MIN_AREA_RATIO = 0.15

/** Busca el contorno cuadrilátero más grande. Devuelve coordenadas en el espacio de `source`. */
export function detectDocument(cv: Cv, source: HTMLCanvasElement): Quad | null {
  const small = downscale(source, DETECT_SIDE)
  const scale = source.width / small.width
  const minArea = small.width * small.height * MIN_AREA_RATIO

  const src = cv.imread(small)
  const gray = new cv.Mat()
  const edges = new cv.Mat()
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5))
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0)
    cv.Canny(gray, edges, 50, 150)
    // Cierra huecos en los bordes del papel
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel)
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

    let best: Point[] | null = null
    let bestArea = minArea

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i)
      const hull = new cv.Mat()
      try {
        cv.convexHull(contour, hull)
        const area = cv.contourArea(hull)
        if (area <= bestArea) continue
        const quad = approxQuad(cv, hull)
        if (quad) {
          best = quad
          bestArea = area
        }
      } finally {
        hull.delete()
        contour.delete()
      }
    }

    return best ? orderQuad(best.map((p) => ({ x: p.x * scale, y: p.y * scale }))) : null
  } finally {
    src.delete(); gray.delete(); edges.delete(); kernel.delete(); contours.delete(); hierarchy.delete()
  }
}

/** Simplifica un contorno convexo a 4 vértices probando tolerancias crecientes. */
function approxQuad(cv: Cv, hull: InstanceType<Cv['Mat']>): Point[] | null {
  const perimeter = cv.arcLength(hull, true)
  for (const eps of [0.02, 0.03, 0.05, 0.08]) {
    const approx = new cv.Mat()
    try {
      cv.approxPolyDP(hull, approx, eps * perimeter, true)
      if (approx.rows === 4) {
        const d = approx.data32S
        return [0, 1, 2, 3].map((k) => ({ x: d[k * 2], y: d[k * 2 + 1] }))
      }
      if (approx.rows < 4) return null
    } finally {
      approx.delete()
    }
  }
  return null
}

/** Endereza el cuadrilátero a un rectángulo. */
export function warpDocument(cv: Cv, source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const [tl, tr, br, bl] = quad
  let width = Math.max(distance(tl, tr), distance(bl, br))
  let height = Math.max(distance(tl, bl), distance(tr, br))
  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(width, height))
  width = Math.round(width * scale)
  height = Math.round(height * scale)

  const src = cv.imread(source)
  const dst = new cv.Mat()
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, quad.flatMap((p) => [p.x, p.y]))
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height])
  const matrix = cv.getPerspectiveTransform(from, to)
  try {
    cv.warpPerspective(src, dst, matrix, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar())
    const out = createCanvas(width, height)
    cv.imshow(out, dst)
    return out
  } finally {
    src.delete(); dst.delete(); from.delete(); to.delete(); matrix.delete()
  }
}

/** Aplica el filtro de escaneo. 'color' devuelve la misma imagen. */
export function applyFilter(cv: Cv, source: HTMLCanvasElement, filter: ScanFilter): HTMLCanvasElement {
  if (filter === 'color') return source

  const src = cv.imread(source)
  const gray = new cv.Mat()
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    if (filter === 'bw') {
      // Umbral adaptativo: elimina sombras y deja fondo blanco / tinta negra
      cv.medianBlur(gray, gray, 3)
      let block = Math.round(Math.max(source.width, source.height) / 60)
      block = Math.max(15, block % 2 === 0 ? block + 1 : block)
      cv.adaptiveThreshold(gray, gray, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, block, 12)
    }
    const out = createCanvas(source.width, source.height)
    cv.imshow(out, gray)
    return out
  } finally {
    src.delete(); gray.delete()
  }
}
