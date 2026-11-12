// Catálogo de herramientas. `where` indica dónde se procesa:
//  - 'local': en el navegador (pdf-lib / pdf.js / OpenCV.js), el archivo no sale del dispositivo.
//  - 'server': en el backend FastAPI del PC (OCR, compresión, conversiones de Office...).
// `ready` se pone a true cuando la herramienta está implementada.
// `color` es una variable CSS de color de sistema iOS (--c-*), usada en el icono de la fila.

import {
  FileText, FileType, Hash, Images, Image as ImageIcon, LayoutGrid, Lock, LockOpen, Merge,
  Minimize2, ScanLine, ScanText, Signature, Split, Stamp, Type, Wrench, type LucideIcon,
} from 'lucide-react'

export type ToolWhere = 'local' | 'server'

export interface Tool {
  id: string
  name: string
  description: string
  group: 'Escanear y firmar' | 'Organizar' | 'Optimizar' | 'Convertir' | 'Editar y seguridad'
  where: ToolWhere
  ready: boolean
  icon: LucideIcon
  color: string
}

export const TOOLS: Tool[] = [
  { id: 'scan', name: 'Escanear', description: 'Fotografía documentos y crea un PDF', group: 'Escanear y firmar', where: 'local', ready: true, icon: ScanLine, color: '--c-blue' },
  { id: 'sign', name: 'Firmar', description: 'Dibuja tu firma y colócala', group: 'Escanear y firmar', where: 'local', ready: true, icon: Signature, color: '--c-indigo' },

  { id: 'merge', name: 'Unir', description: 'Combina varios PDF en uno', group: 'Organizar', where: 'local', ready: true, icon: Merge, color: '--c-orange' },
  { id: 'split', name: 'Dividir', description: 'Extrae rangos de páginas', group: 'Organizar', where: 'local', ready: true, icon: Split, color: '--c-orange' },
  { id: 'organize', name: 'Organizar páginas', description: 'Reordena, rota y elimina', group: 'Organizar', where: 'local', ready: true, icon: LayoutGrid, color: '--c-orange' },

  { id: 'compress', name: 'Comprimir', description: 'Reduce el tamaño del archivo', group: 'Optimizar', where: 'server', ready: false, icon: Minimize2, color: '--c-green' },
  { id: 'ocr', name: 'Reconocer texto', description: 'Texto seleccionable y buscable', group: 'Optimizar', where: 'server', ready: false, icon: ScanText, color: '--c-green' },
  { id: 'repair', name: 'Reparar', description: 'Recupera PDFs dañados', group: 'Optimizar', where: 'server', ready: false, icon: Wrench, color: '--c-green' },

  { id: 'office-to-pdf', name: 'Office a PDF', description: 'Word, Excel, PowerPoint', group: 'Convertir', where: 'server', ready: false, icon: FileText, color: '--c-teal' },
  { id: 'pdf-to-word', name: 'PDF a Word', description: 'Documento DOCX editable', group: 'Convertir', where: 'server', ready: false, icon: FileType, color: '--c-teal' },
  { id: 'jpg-to-pdf', name: 'Imágenes a PDF', description: 'JPG y PNG', group: 'Convertir', where: 'local', ready: true, icon: Images, color: '--c-teal' },
  { id: 'pdf-to-jpg', name: 'PDF a imágenes', description: 'Cada página en JPG', group: 'Convertir', where: 'local', ready: true, icon: ImageIcon, color: '--c-teal' },

  { id: 'watermark', name: 'Marca de agua', description: 'Texto o imagen sobre las páginas', group: 'Editar y seguridad', where: 'local', ready: true, icon: Stamp, color: '--c-purple' },
  { id: 'page-numbers', name: 'Numerar páginas', description: 'Añade números de página', group: 'Editar y seguridad', where: 'local', ready: true, icon: Hash, color: '--c-purple' },
  { id: 'annotate', name: 'Añadir texto', description: 'Texto, fecha, ✓, resaltar y dibujar', group: 'Editar y seguridad', where: 'local', ready: true, icon: Type, color: '--c-purple' },
  { id: 'protect', name: 'Proteger', description: 'Cifra con contraseña', group: 'Editar y seguridad', where: 'server', ready: false, icon: Lock, color: '--c-gray' },
  { id: 'unlock', name: 'Desbloquear', description: 'Quita la contraseña', group: 'Editar y seguridad', where: 'server', ready: false, icon: LockOpen, color: '--c-gray' },
]
