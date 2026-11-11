import { FileText, Share } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { canShareFile, downloadFile, formatBytes, shareFile } from '../lib/share'
import { NavBar } from './NavBar'

interface ExportViewProps {
  file: File
  pageCount: number
  thumbUrl?: string
  back: { onClick: () => void; label: string }
  /** Acciones adicionales (p. ej. "Firmar") bajo los botones principales. */
  extraActions?: ReactNode
}

/** Pantalla final común: miniatura, nombre, tamaño y Compartir / Descargar. */
export function ExportView({ file, pageCount, thumbUrl, back, extraActions }: ExportViewProps) {
  const navigate = useNavigate()
  const shareable = canShareFile(file)
  return (
    <div className="screen screen-fixed">
      <NavBar
        back={back}
        trailing={<button type="button" className="bar-button strong" onClick={() => navigate('/')}>OK</button>}
      />
      <main className="content export fade-in">
        <div className="export-thumb">
          {thumbUrl ? <img src={thumbUrl} alt="" /> : <FileText size={48} />}
        </div>
        <h2>{file.name.replace(/\.pdf$/i, '')}</h2>
        <p>PDF · {pageCount} {pageCount === 1 ? 'página' : 'páginas'} · {formatBytes(file.size)}</p>
        <div className="actions">
          {shareable && (
            <button type="button" className="btn btn-primary btn-block" onClick={() => void shareFile(file)}>
              <Share size={20} /> Compartir o guardar
            </button>
          )}
          <button type="button" className={`btn btn-block ${shareable ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => downloadFile(file)}>
            Descargar
          </button>
          {extraActions}
        </div>
      </main>
    </div>
  )
}
