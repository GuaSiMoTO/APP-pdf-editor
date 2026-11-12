import { FileUp, type LucideIcon } from 'lucide-react'
import { useRef } from 'react'
import { NavBar } from './NavBar'

const PDF_ACCEPT = 'application/pdf,.pdf'

interface Props {
  icon: LucideIcon
  color: string // variable CSS --c-*
  title: string
  text: string
  multiple?: boolean
  accept?: string
  buttonLabel?: string
  disabled?: boolean
  onFiles: (files: File[]) => void
}

/** Estado vacío común de las herramientas que empiezan abriendo un archivo. */
export function OpenPdfEmpty({ icon: Icon, color, title, text, multiple, accept = PDF_ACCEPT, buttonLabel = 'Elegir PDF', disabled, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="screen screen-fixed">
      <NavBar back={{ to: '/', label: 'Inicio' }} />
      <main className="content fade-in">
        <div className="empty">
          <div className="empty-icon" style={{ background: `var(${color})`, opacity: disabled ? 0.5 : 1 }}>
            <Icon size={44} strokeWidth={1.8} />
          </div>
          <h2>{title}</h2>
          <p>{text}</p>
          <div className="actions">
            <button type="button" className="btn btn-primary btn-block" disabled={disabled} onClick={() => input.current?.click()}>
              <FileUp size={20} /> {buttonLabel}
            </button>
          </div>
        </div>
      </main>
      <PdfInput inputRef={input} multiple={multiple} accept={accept} onFiles={onFiles} />
    </div>
  )
}

/** <input type="file"> oculto (PDF por defecto). */
export function PdfInput({ inputRef, multiple, accept = PDF_ACCEPT, onFiles }: {
  inputRef: React.RefObject<HTMLInputElement | null>
  multiple?: boolean
  accept?: string
  onFiles: (files: File[]) => void
}) {
  return (
    <input ref={inputRef} className="visually-hidden" type="file" accept={accept} multiple={multiple}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = ''
        if (files.length) onFiles(files)
      }} />
  )
}
