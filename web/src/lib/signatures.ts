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
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SavedSignature[]
  } catch {
    return []
  }
}

export function storeSignatures(list: SavedSignature[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* sin almacenamiento disponible */
  }
}
