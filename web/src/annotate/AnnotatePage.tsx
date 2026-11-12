import { Type } from 'lucide-react'
import { useRef, useState } from 'react'
import { applyAnnotations, type Annot, type TextAnnot } from '../lib/annotations'
import { firstPageThumbnail } from '../lib/pdfjs'
import { baseName, safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty, PdfInput } from '../ui/OpenPdfEmpty'
import { useElementSize } from '../ui/useElementSize'
import { useTask } from '../ui/useTask'
import { AnnotPage } from './AnnotPage'
import type { Tool, ToolStyle } from './gestures'
import { useUndoable } from './history'
import { TextComposer } from './TextComposer'
import { DEFAULT_STYLE, INKS, TEXT_SIZES } from './palette'
import { Toolbar } from './Toolbar'

/** Herramientas de un solo uso: tras colocar, se vuelve a "Mover" con el elemento seleccionado. */
const ONE_SHOT: Tool[] = ['text', 'date', 'check', 'cross']

type Composer = { mode: 'new'; page: number; x: number; y: number } | { mode: 'edit'; annot: TextAnnot }

export default function AnnotatePage() {
  const [doc, setDoc] = useOpenPdf()
  const annots = useUndoable<Annot[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [style, setStyle] = useState<ToolStyle>(DEFAULT_STYLE)
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
      annots.reset([])
      setSelectedId(null)
    })

  const undo = () => {
    if (annots.undo()) setSelectedId(null)
  }

  const create = (a: Annot) => {
    annots.snapshot()
    annots.set((list) => [...list, a])
    if (ONE_SHOT.includes(tool)) {
      setTool('select')
      setSelectedId(a.id)
    }
  }
  const change = (a: Annot) => annots.set((list) => list.map((x) => (x.id === a.id ? a : x)))
  const remove = (id: string) => {
    annots.snapshot()
    annots.set((list) => list.filter((x) => x.id !== id))
    setSelectedId(null)
  }

  const saveText = (text: string, textSize: number, color: string) => {
    const c = composer
    setComposer(null)
    if (!c) return
    if (c.mode === 'edit') {
      annots.snapshot()
      if (!text.trim()) annots.set((list) => list.filter((x) => x.id !== c.annot.id))
      else change({ ...c.annot, text, size: textSize, color })
      return
    }
    if (!text.trim()) return
    create({ id: crypto.randomUUID(), page: c.page, kind: 'text', x: c.x, y: c.y, text, size: textSize, color })
  }

  const chooseTool = (t: Tool) => {
    setTool(t)
    if (t !== 'select') setSelectedId(null)
  }

  const save = () =>
    run('Guardando…', async () => {
      if (!doc) return
      const blob = await applyAnnotations(doc.bytes, annots.value)
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

  return (
    <div className="screen screen-fixed">
      <NavBar
        title={baseName(doc.file.name)}
        back={{ to: '/', label: 'Inicio' }}
        trailing={<button type="button" className="bar-button strong" disabled={!annots.value.length} onClick={save}>Guardar</button>}
      />
      <div ref={scrollRef} className="pdf-scroll">
        {pageWidth > 0 && doc.sizes.map((s, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <AnnotPage
              doc={doc.view} index={i} W={s.W} H={s.H} cssWidth={pageWidth}
              annots={annots.value.filter((a) => a.page === i)}
              selectedId={selectedId} tool={tool} style={style}
              onSelect={setSelectedId} onBegin={annots.snapshot} onChange={change} onCreate={create}
              onPlaceText={(page, x, y) => setComposer({ mode: 'new', page, x, y })}
              onEdit={(annot) => setComposer({ mode: 'edit', annot })}
              onDelete={remove}
            />
            <div className="page-caption">{i + 1} de {doc.sizes.length}</div>
          </div>
        ))}
      </div>

      <Toolbar
        tool={tool} onTool={chooseTool} style={style} setStyle={setStyle}
        hasAnnots={annots.value.length > 0} canUndo={annots.canUndo} onUndo={undo}
        onOpen={() => fileInput.current?.click()}
      />
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
