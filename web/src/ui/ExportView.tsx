import { FileText, Files, Share } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { canShareFiles, downloadFile, formatBytes, shareFiles, zipFiles } from '../lib/share'
import { NavBar } from './NavBar'

interface ExportViewProps {
  files: File[]
  /** Título; por defecto, el nombre del archivo (o "N archivos"). */
  title?: string
  /** Detalle bajo el título, p. ej. "3 páginas". Se le añade el tamaño. */
  detail: string
  thumbUrl?: string
  back: { onClick: () => void; label: string }
  /** Nombre del ZIP al descargar varios archivos. */
  zipName?: string
  /** Acciones adicionales (p. ej. "Firmar") bajo los botones principales. */
  extraActions?: ReactNode
}

/** Pantalla final común: miniatura, nombre, tamaño y Compartir / Descargar. */
export function ExportView({ files, title, detail, thumbUrl, back, zipName = 'Documentos.zip', extraActions }: ExportViewProps) {
  const navigate = useNavigate()
  const shareable = canShareFiles(files)
  const single = files.length === 1
  const total = files.reduce((n, f) => n + f.size, 0)

  const download = async () => {
    if (single) downloadFile(files[0])
    else downloadFile(await zipFiles(files, zipName))
  }

  return (
    <div className="screen screen-fixed">
      <NavBar
        back={back}
        trailing={<button type="button" className="bar-button strong" onClick={() => navigate('/')}>OK</button>}
      />
      <main className="content scroll export fade-in">
        <div className="export-thumb">
          {thumbUrl ? <img src={thumbUrl} alt="" /> : single ? <FileText size={48} /> : <Files size={48} />}
        </div>
        <h2>{title ?? (single ? files[0].name.replace(/\.[^.]+$/, '') : `${files.length} archivos`)}</h2>
        <p>{detail} · {formatBytes(total)}</p>
        <div className="actions">
          {shareable && (
            <button type="button" className="btn btn-primary btn-block" onClick={() => void shareFiles(files)}>
              <Share size={20} /> Compartir o guardar
            </button>
          )}
          <button type="button" className={`btn btn-block ${shareable ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => void download()}>
            {single ? 'Descargar' : 'Descargar ZIP'}
          </button>
          {extraActions}
        </div>
        {!single && (
          <ul className="file-list">
            {files.map((f) => (
              <li key={f.name}><FileText size={16} /> <span>{f.name}</span> <small>{formatBytes(f.size)}</small></li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
