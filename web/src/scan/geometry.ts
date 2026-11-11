export interface Point {
  x: number
  y: number
}

/** Cuadrilátero en orden: superior-izq, superior-der, inferior-der, inferior-izq. */
export type Quad = [Point, Point, Point, Point]

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** Ordena 4 puntos arbitrarios como TL, TR, BR, BL. */
export function orderQuad(points: Point[]): Quad {
  const bySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y))
  const byDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x))
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]]
}

/** Cuadrilátero por defecto (casi toda la imagen) cuando no se detecta el documento. */
export function defaultQuad(width: number, height: number, inset = 0.06): Quad {
  const dx = width * inset
  const dy = height * inset
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ]
}
