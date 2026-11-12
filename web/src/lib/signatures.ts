// Firmas guardadas en este dispositivo (localStorage). Son PNG con fondo transparente
// recortados al trazo. Si el almacenamiento falla (modo privado), la app sigue funcionando
// y la firma solo dura la sesión.

export interface SavedSignature {
  id: string
  dataUrl: string
  width: number
  height: number
  createdAt: number
}

// Clave histórica (nombre anterior de la app): no cambiarla o se pierden las firmas guardadas
const KEY = 'documentos.signatures'

export function loadSignatures(): SavedSignature[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    // Descarta entradas corruptas en vez de romper la pantalla de firmar
    return Array.isArray(raw) ? raw.filter(isSignature) : []
  } catch {
    return []
  }
}

function isSignature(s: unknown): s is SavedSignature {
  const x = s as Partial<SavedSignature> | null
  return !!x && typeof x.id === 'string' && typeof x.dataUrl === 'string'
    && x.dataUrl.startsWith('data:image/png;base64,')
    && typeof x.width === 'number' && x.width > 0 && typeof x.height === 'number' && x.height > 0
}

/** Guarda la lista. Devuelve false si no se pudo (almacenamiento lleno o modo privado):
 *  quien llama debe avisar de que la firma no estará disponible la próxima vez. */
export function storeSignatures(list: SavedSignature[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch (err) {
    console.error('No se pudieron guardar las firmas', err)
    return false
  }
}
