import {
  CalendarDays, Check, FileUp, Highlighter, MousePointer2, PenLine, RectangleHorizontal, Type, Undo2, X,
  type LucideIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { applyAnnotations, type Annot, type TextAnnot } from '../lib/annotations'
import { firstPageThumbnail } from '../lib/pdfjs'
import { baseName, safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { ColorDots, Segmented } from '../ui/controls'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty, PdfInput } from '../ui/OpenPdfEmpty'
import { useElementSize } from '../ui/useElementSize'
import { useTask } from '../ui/useTask'
import { AnnotPage, type Tool, type ToolStyle } from './AnnotPage'
import { TextComposer } from './TextComposer'

const TOOLS: { id: Tool; label: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'Mover', icon: MousePointer2 },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'date', label: 'Fecha', icon: CalendarDays },
  { id: 'check', label: 'Marca', icon: Check },
  { id: 'cross', label: 'Cruz', icon: X },
  { id: 'highlight', label: 'Resaltar', icon: Highlighter },
  { id: 'cover', label: 'Tapar', icon: RectangleHorizontal },
  { id: 'pen', label: 'Dibujar', icon: PenLine },
]
const INKS = [
  { color: '#1c1c1e', label: 'Negro' }, { color: '#123f9c', label: 'Azul' },
  { color: '#d70015', label: 'Rojo' }, { color: '#248a3d', label: 'Verde' },
]
const HIGHLIGHTS = [
  { color: '#ffd60a', label: 'Amarillo' }, { color: '#30d158', label: 'Verde' },
  { color: '#ff6482', label: 'Rosa' }, { color: '#64d2ff', label: 'Azul' },
]
const TEXT_SIZES = { S: 9, M: 12, L: 16 } as const
const PEN_WIDTHS = { S: 1, M: 2, L: 4 } as const
/** Herramientas de un solo uso: tras colocar, se vuelve a "Mover" con el elemento seleccionado. */
const ONE_SHOT: Tool[] = ['text', 'date', 'check', 'cross']

type Composer = { mode: 'new'; page: number; x: number; y: number } | { mode: 'edit'; annot: TextAnnot }

export default function AnnotatePage() {
  const [doc, setDoc] = useOpenPdf()
  const [annots, setAnnots] = useState<Annot[]>([])
  const [history, setHistory] = useState<Annot[][]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [style, setStyle] = useState<ToolStyle>({ color: INKS[0].color, textSize: 12, penWidth: 2, highlightColor: HIGHLIGHTS[0].color })
  const [composer, setComposer] = useState<Composer | null>(null)
  const [output, setOutput] = useState<{ file: File; thumb: string } | null>(null)
  const { busy, run } = useTask()
  const fileInput = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(scrollRef)
  const pageWidth = size ? Math.min(size.width - 32, 760) : 0

  const open = (file: File) =>
    run('Abriendo PDF…', async () => {
      setDoc(await loadPdfFile(file))
      setAnnots([])
      setHistory([])
      setSelectedId(null)
    })

  /** Guarda el estado actual para poder deshacer. */
  const snapshot = () => setHistory((h) => [...h.slice(-49), annots])
  const undo = () => {
    const prev = history[history.length - 1]
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setAnnots(prev)
    setSelectedId(null)
  }

  const create = (a: Annot) => {
    snapshot()
    setAnnots((list) => [...list, a])
    if (ONE_SHOT.includes(tool)) {
      setTool('select')
      setSelectedId(a.id)
    }
  }
  const change = (a: Annot) => setAnnots((list) => list.map((x) => (x.id === a.id ? a : x)))
  const remove = (id: string) => {
    snapshot()
    setAnnots((list) => list.filter((x) => x.id !== id))
    setSelectedId(null)
  }

  const saveText = (text: string, size: number, color: string) => {
    const c = composer
    setComposer(null)
    if (!c) return
    if (c.mode === 'edit') {
      snapshot()
      if (!text.trim()) setAnnots((list) => list.filter((x) => x.id !== c.annot.id))
      else change({ ...c.annot, text, size, color })
      return
    }
    if (!text.trim()) return
    create({ id: crypto.randomUUID(), page: c.page, kind: 'text', x: c.x, y: c.y, text, size, color })
  }

  const chooseTool = (t: Tool) => {
    setTool(t)
    if (t !== 'select') setSelectedId(null)
  }

  const save = () =>
    run('Guardando…', async () => {
      if (!doc) return
      const blob = await applyAnnotations(doc.bytes, annots)
      const file = new File([blob], `${safeFileName(baseName(doc.file.name))} editado.pdf`, { type: 'application/pdf' })
      setOutput({ file, thumb: await firstPageThumbnail(file) })
    })

  if (output && doc) {
    return (
      <ExportView files={[output.file]} detail={pagesLabel(doc.aspects.length)} thumbUrl={output.thumb}
        back={{ onClick: () => { URL.revokeObjectURL(output.thumb); setOutput(null) }, label: 'Editar' }} />
    )
  }

  if (!doc) {
    return (
      <>
        <OpenPdfEmpty icon={Type} color="--c-purple" title="Añadir texto"
          text="Escribe sobre el PDF, rellena formularios con fecha, ✓ y ✗, resalta, tapa o dibuja a mano."
          onFiles={([f]) => void open(f)} />
        {busy && <Loading label={busy} />}
      </>
    )
  }

  const sizeKey = (Object.keys(TEXT_SIZES) as (keyof typeof TEXT_SIZES)[]).find((k) => TEXT_SIZES[k] === style.textSize) ?? 'M'
  const penKey = (Object.keys(PEN_WIDTHS) as (keyof typeof PEN_WIDTHS)[]).find((k) => PEN_WIDTHS[k] === style.penWidth) ?? 'M'

  return (
    <div className="screen screen-fixed">
      <NavBar
        title={baseName(doc.file.name)}
        back={{ to: '/', label: 'Inicio' }}
        trailing={<button type="button" className="bar-button strong" disabled={!annots.length} onClick={save}>Guardar</button>}
      />
      <div ref={scrollRef} className="pdf-scroll">
        {pageWidth > 0 && doc.sizes.map((s, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <AnnotPage
              doc={doc.view} index={i} W={s.W} H={s.H} cssWidth={pageWidth}
              annots={annots.filter((a) => a.page === i)}
              selectedId={selectedId} tool={tool} style={style}
              onSelect={setSelectedId} onBegin={snapshot} onChange={change} onCreate={create}
              onPlaceText={(page, x, y) => setComposer({ mode: 'new', page, x, y })}
              onEdit={(annot) => setComposer({ mode: 'edit', annot })}
              onDelete={remove}
            />
            <div className="page-caption">{i + 1} de {doc.sizes.length}</div>
          </div>
        ))}
      </div>

      <footer className="toolbar annot-toolbar">
        <div className="tool-options">
          {tool === 'select' && <span className="hint">{annots.length ? 'Toca un elemento para moverlo, cambiar su tamaño o eliminarlo' : 'Elige una herramienta'}</span>}
          {(tool === 'text' || tool === 'date') && (
            <>
              <ColorDots value={style.color} colors={INKS} onChange={(color) => setStyle((s) => ({ ...s, color }))} />
              <Segmented value={sizeKey} onChange={(k) => setStyle((s) => ({ ...s, textSize: TEXT_SIZES[k] }))}
                options={[{ id: 'S', label: 'A' }, { id: 'M', label: 'A+' }, { id: 'L', label: 'A++' }]} />
            </>
          )}
          {(tool === 'check' || tool === 'cross') && (
            <ColorDots value={style.color} colors={INKS} onChange={(color) => setStyle((s) => ({ ...s, color }))} />
          )}
          {tool === 'pen' && (
            <>
              <ColorDots value={style.color} colors={INKS} onChange={(color) => setStyle((s) => ({ ...s, color }))} />
              <Segmented value={penKey} onChange={(k) => setStyle((s) => ({ ...s, penWidth: PEN_WIDTHS[k] }))}
                options={[{ id: 'S', label: 'Fino' }, { id: 'M', label: 'Medio' }, { id: 'L', label: 'Grueso' }]} />
            </>
          )}
          {tool === 'highlight' && (
            <ColorDots value={style.highlightColor} colors={HIGHLIGHTS} onChange={(highlightColor) => setStyle((s) => ({ ...s, highlightColor }))} />
          )}
          {tool === 'cover' && <span className="hint">Tapa con blanco. Ojo: el contenido sigue dentro del PDF.</span>}
          {['text', 'date', 'check', 'cross'].includes(tool) && <span className="hint grow">Toca la página</span>}
          {['highlight', 'pen'].includes(tool) && <span className="hint grow">Arrastra sobre la página</span>}
        </div>
        <div className="tool-row">
          <button type="button" className="tool-btn" aria-label="Deshacer" disabled={!history.length} onClick={undo}>
            <Undo2 size={22} />
          </button>
          <span className="tool-sep" />
          {TOOLS.map((t) => {
            const Icon = t.icon
            return (
              <button key={t.id} type="button" className="tool-btn" aria-pressed={tool === t.id} onClick={() => chooseTool(t.id)}>
                <Icon size={22} />
                <span>{t.label}</span>
              </button>
            )
          })}
          <span className="tool-sep" />
          <button type="button" className="tool-btn" aria-label="Abrir otro PDF" onClick={() => fileInput.current?.click()}>
            <FileUp size={22} />
          </button>
        </div>
      </footer>
      <PdfInput inputRef={fileInput} onFiles={([f]) => void open(f)} />
      {/* Encima de las páginas (no las sustituye) para conservar el scroll al volver */}
      {composer && (
        <TextComposer
          initialText={composer.mode === 'edit' ? composer.annot.text : ''}
          initialSize={composer.mode === 'edit' ? composer.annot.size : style.textSize}
          initialColor={composer.mode === 'edit' ? composer.annot.color : style.color}
          sizes={TEXT_SIZES}
          colors={INKS}
          onCancel={() => setComposer(null)}
          onDone={saveText}
        />
      )}
      {busy && <Loading label={busy} />}
    </div>
  )
}
