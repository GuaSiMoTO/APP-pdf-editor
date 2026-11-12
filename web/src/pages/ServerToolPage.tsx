import { FileText, FileUp, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { runServerTool, useServerStatus, type ServerResult } from '../api'
import { firstPageThumbnail } from '../lib/pdfjs'
import { formatBytes } from '../lib/share'
import { TOOLS } from '../tools'
import { OptionRow, Segmented } from '../ui/controls'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty, PdfInput } from '../ui/OpenPdfEmpty'
import { useTask } from '../ui/useTask'

type Options = Record<string, string>

interface ServerToolConfig {
  accept: string
  emptyText: string
  buttonLabel?: string
  action: string // texto del botón principal
  busy: string // texto del HUD
  defaults: Options
  /** Opciones propias; `valid` decide si se puede ejecutar. */
  options?: (o: Options, set: (patch: Options) => void) => ReactNode
  valid?: (o: Options) => string | null // mensaje si no es válido
  detail?: (r: ServerResult) => string
}

const OFFICE_ACCEPT = '.doc,.docx,.odt,.rtf,.txt,.xls,.xlsx,.ods,.csv,.ppt,.pptx,.odp'

function PasswordField({ value, onChange, placeholder, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean
}) {
  return (
    <label className="row">
      <input className="text-field" type="password" value={value} placeholder={placeholder} autoFocus={autoFocus}
        autoComplete="new-password" autoCapitalize="off" autoCorrect="off" enterKeyHint="done"
        onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

const CONFIGS: Record<string, ServerToolConfig> = {
  compress: {
    accept: 'application/pdf,.pdf',
    emptyText: 'Reduce el tamaño del PDF optimizando sus imágenes, ideal para enviarlo por correo.',
    action: 'Comprimir', busy: 'Comprimiendo…',
    defaults: { level: 'medium' },
    options: (o, set) => (
      <div className="list">
        <OptionRow label="Nivel de compresión" stacked>
          <Segmented value={o.level} onChange={(level) => set({ level })}
            options={[{ id: 'low', label: 'Baja' }, { id: 'medium', label: 'Recomendada' }, { id: 'high', label: 'Extrema' }]} />
        </OptionRow>
        <p className="footnote">
          {o.level === 'low' ? 'Máxima calidad, menor reducción.' : o.level === 'high' ? 'Archivo mínimo; las imágenes pierden calidad.' : 'Buen equilibrio entre tamaño y calidad.'}
        </p>
      </div>
    ),
    detail: (r) => r.file.size >= r.originalSize
      ? `Ya estaba optimizado · ${formatBytes(r.file.size)}`
      : `${formatBytes(r.originalSize)} → ${formatBytes(r.file.size)} · −${Math.round((1 - r.file.size / r.originalSize) * 100)} %`,
  },
  ocr: {
    accept: 'application/pdf,.pdf',
    emptyText: 'Convierte un PDF escaneado en un documento con texto seleccionable y buscable.',
    action: 'Reconocer texto', busy: 'Reconociendo texto… puede tardar unos minutos',
    defaults: { lang: 'both' },
    options: (o, set) => (
      <div className="list">
        <OptionRow label="Idioma del documento" stacked>
          <Segmented value={o.lang} onChange={(lang) => set({ lang })}
            options={[{ id: 'spa', label: 'Español' }, { id: 'eng', label: 'Inglés' }, { id: 'both', label: 'Ambos' }]} />
        </OptionRow>
        <p className="footnote">Las páginas que ya tienen texto se dejan como están. También endereza y gira las páginas escaneadas.</p>
      </div>
    ),
  },
  repair: {
    accept: 'application/pdf,.pdf',
    emptyText: 'Intenta recuperar un PDF dañado que no se abre o da errores.',
    action: 'Reparar', busy: 'Reparando…', defaults: {},
  },
  'office-to-pdf': {
    accept: OFFICE_ACCEPT,
    emptyText: 'Convierte documentos de Word, Excel o PowerPoint (y OpenDocument) a PDF.',
    buttonLabel: 'Elegir documento',
    action: 'Convertir a PDF', busy: 'Convirtiendo…', defaults: {},
  },
  'pdf-to-word': {
    accept: 'application/pdf,.pdf',
    emptyText: 'Convierte un PDF en un documento de Word editable. Funciona mejor con PDFs de texto que con escaneos.',
    action: 'Convertir a Word', busy: 'Convirtiendo…', defaults: {},
    detail: (r) => `Documento de Word · ${formatBytes(r.file.size)}`,
  },
  protect: {
    accept: 'application/pdf,.pdf',
    emptyText: 'Cifra el PDF con una contraseña (AES-256). Sin ella no se podrá abrir.',
    action: 'Proteger', busy: 'Protegiendo…',
    defaults: { password: '', confirm: '' },
    options: (o, set) => (
      <>
        <h2 className="section-header">Contraseña</h2>
        <div className="list">
          <PasswordField value={o.password} onChange={(password) => set({ password })} placeholder="Contraseña" autoFocus />
          <PasswordField value={o.confirm} onChange={(confirm) => set({ confirm })} placeholder="Repite la contraseña" />
        </div>
        <p className="footnote">Guárdala bien: si la olvidas, no hay forma de recuperar el documento.</p>
      </>
    ),
    valid: (o) => o.password.length < 4 ? 'Mínimo 4 caracteres' : o.password !== o.confirm ? 'Las contraseñas no coinciden' : null,
  },
  unlock: {
    accept: 'application/pdf,.pdf',
    emptyText: 'Quita la contraseña de un PDF del que conoces la clave, para abrirlo sin ella.',
    action: 'Desbloquear', busy: 'Desbloqueando…',
    defaults: { password: '' },
    options: (o, set) => (
      <>
        <h2 className="section-header">Contraseña actual</h2>
        <div className="list">
          <PasswordField value={o.password} onChange={(password) => set({ password })} placeholder="Contraseña del PDF" autoFocus />
        </div>
        <p className="footnote">Si el PDF solo tiene restricciones (imprimir, copiar…) puedes dejarla vacía.</p>
      </>
    ),
  },
}

export default function ServerToolPage({ id }: { id: string }) {
  const tool = TOOLS.find((t) => t.id === id)!
  const config = CONFIGS[id]
  const server = useServerStatus()
  const [file, setFile] = useState<File | null>(null)
  const [opts, setOpts] = useState<Options>(config.defaults)
  const [result, setResult] = useState<{ r: ServerResult; thumb?: string } | null>(null)
  const { busy, run } = useTask()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (result?.thumb) URL.revokeObjectURL(result.thumb)
  }, [result])

  const execute = () =>
    run(config.busy, async () => {
      if (!file) return
      // La confirmación de contraseña es solo de la interfaz
      const send = Object.fromEntries(Object.entries(opts).filter(([k]) => k !== 'confirm'))
      const r = await runServerTool(id, file, send)
      const thumb = r.file.type === 'application/pdf' ? await firstPageThumbnail(r.file).catch(() => undefined) : undefined
      setResult({ r, thumb })
    })

  if (result) {
    return (
      <ExportView files={[result.r.file]} thumbUrl={result.thumb}
        detail={config.detail?.(result.r) ?? (result.r.file.name.endsWith('.pdf') ? 'PDF' : 'Archivo')}
        back={{ onClick: () => setResult(null), label: 'Atrás' }} />
    )
  }

  const unavailable = server.state === 'offline'
    ? 'El PC no está disponible. Esta herramienta se ejecuta en el servidor del PC.'
    : server.state === 'online' && !server.tools[id]
      ? 'Esta herramienta necesita el servidor en Docker, que aún no está en marcha en el PC.'
      : null

  if (!file) {
    return (
      <>
        <OpenPdfEmpty icon={tool.icon as LucideIcon} color={tool.color} title={tool.name}
          text={unavailable ?? config.emptyText} accept={config.accept}
          buttonLabel={config.buttonLabel} disabled={!!unavailable}
          onFiles={([f]) => setFile(f)} />
      </>
    )
  }

  const invalid = config.valid?.(opts) ?? null
  return (
    <div className="screen screen-fixed">
      <NavBar title={tool.name} back={{ to: '/', label: 'Inicio' }} />
      <main className="content scroll">
        <h2 className="section-header">Archivo</h2>
        <div className="list">
          <div className="row">
            <span className="row-icon" style={{ background: `var(${tool.color})` }}><FileText size={18} /></span>
            <span className="row-text">
              <span className="row-title ellipsis">{file.name}</span>
              <span className="row-detail">{formatBytes(file.size)}</span>
            </span>
            <button type="button" className="icon-button" aria-label="Cambiar archivo" onClick={() => input.current?.click()}>
              <FileUp size={20} />
            </button>
          </div>
        </div>
        {config.options && <div style={{ marginTop: 8 }}>{config.options(opts, (patch) => setOpts((o) => ({ ...o, ...patch })))}</div>}
        {unavailable && <p className="footnote error">{unavailable}</p>}
      </main>
      <footer className="toolbar">
        <div className="toolbar-inner">
          <button type="button" className="btn btn-primary" disabled={!!invalid || !!unavailable} onClick={execute}>
            {invalid ?? config.action}
          </button>
        </div>
      </footer>
      <PdfInput inputRef={input} accept={config.accept} onFiles={([f]) => setFile(f)} />
      {busy && <Loading label={busy} />}
    </div>
  )
}
