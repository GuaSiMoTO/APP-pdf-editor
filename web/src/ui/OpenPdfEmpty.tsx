import { FileUp, type LucideIcon } from 'lucide-react'
import { useRef } from 'react'
import { NavBar } from './NavBar'

interface Props {
  icon: LucideIcon
  color: string // variable CSS --c-*
  title: string
  text: string
  multiple?: boolean
  buttonLabel?: string
  onFiles: (files: File[]) => void
}

/** Estado vacío común de las herramientas que empiezan abriendo PDFs. */
export function OpenPdfEmpty({ icon: Icon, color, title, text, multiple, buttonLabel = 'Elegir PDF', onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="screen screen-fixed">
      <NavBar back={{ to: '/', label: 'Inicio' }} />
      <main className="content fade-in">
        <div className="empty">
          <div className="empty-icon" style={{ background: `var(${color})` }}>
            <Icon size={44} strokeWidth={1.8} />
          </div>
          <h2>{title}</h2>
          <p>{text}</p>
          <div className="actions">
            <button type="button" className="btn btn-primary btn-block" onClick={() => input.current?.click()}>
              <FileUp size={20} /> {buttonLabel}
            </button>
          </div>
        </div>
      </main>
      <PdfInput inputRef={input} multiple={multiple} onFiles={onFiles} />
    </div>
  )
}

/** <input type="file"> oculto para PDFs. */
export function PdfInput({ inputRef, multiple, onFiles }: {
  inputRef: React.RefObject<HTMLInputElement | null>
  multiple?: boolean
  onFiles: (files: File[]) => void
}) {
  return (
    <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" multiple={multiple}
      onChange={(e) => {
        const files = Array.from(e.target.files ?? [])
        e.target.value = ''
        if (files.length) onFiles(files)
      }} />
  )
}
