// Utilidades de imagen con Canvas 2D (sin OpenCV).
import { UserError } from '../lib/errors'

/** Lado mayor máximo de la foto de trabajo: cabe holgado en los límites de canvas de iOS
 *  y da ~300 ppp en A4 tras el recorte. */
const MAX_SOURCE_SIDE = 3000
/** Archivos mayores no se intentan decodificar (una foto de iPhone ocupa 2–8 MB). */
const MAX_IMAGE_BYTES = 40 * 1024 * 1024
/** Píxeles máximos de la imagen original: decodificarla ya reserva esa memoria (4 bytes/px). */
const MAX_IMAGE_PIXELS = 50_000_000

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))
  return c
}

/** Libera la memoria de un canvas que ya no se usa. Safari iOS tarda en recolectarla
 *  y tiene un límite total de memoria de canvas; ponerlo a 0×0 la libera al momento. */
export function releaseCanvas(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return
  canvas.width = 0
  canvas.height = 0
}

/** Decodifica una imagen (respetando la orientación EXIF, que Safari aplica al <img>)
 *  y la reduce a MAX_SOURCE_SIDE. */
export async function loadImageFile(file: Blob, maxSide = MAX_SOURCE_SIDE): Promise<HTMLCanvasElement> {
  if (file.size > MAX_IMAGE_BYTES) throw new UserError('La imagen es demasiado grande (máximo 40 MB).')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch (err) {
      throw new UserError('No se puede leer la imagen. Prueba con una foto JPG, PNG o HEIC.', { cause: err })
    }
    if (img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS) {
      throw new UserError('La imagen tiene demasiada resolución (máximo 50 megapíxeles).')
    }
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = createCanvas(img.naturalWidth * scale, img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Copia escalada para que el lado mayor no supere maxSide. */
export function downscale(source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height))
  const out = createCanvas(source.width * scale, source.height * scale)
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, out.width, out.height)
  return out
}

/** Rota en múltiplos de 90° (quarterTurns en sentido horario). */
export function rotate(source: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const turns = ((quarterTurns % 4) + 4) % 4
  if (turns === 0) return source
  const swap = turns % 2 === 1
  const out = createCanvas(swap ? source.height : source.width, swap ? source.width : source.height)
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return out
}

export function toJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob devolvió null'))), 'image/jpeg', quality),
  )
}
