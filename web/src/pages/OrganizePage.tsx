import { FileUp, LayoutGrid, RotateCcw, RotateCw, Trash } from 'lucide-react'
import { useRef, useState } from 'react'
import { firstPageThumbnail } from '../lib/pdfjs'
import { baseName, buildPdfs, safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty, PdfInput } from '../ui/OpenPdfEmpty'
import { PageTile } from '../ui/PageTile'
import { useSortable } from '../ui/useSortable'
import { useTask } from '../ui/useTask'

interface PageItem {
  id: string
  index: number // página del original (0-based)
  rotation: number // giro extra en grados
}

export default function OrganizePage() {
  const [doc, setDoc] = useOpenPdf()
  const [pages, setPages] = useState<PageItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [output, setOutput] = useState<{ file: File; thumb: string } | null>(null)
  const { busy, run } = useTask()
  const fileInput = useRef<HTMLInputElement>(null)
  const { itemProps, dragIndex } = useSortable(pages, setPages)

  const open = (file: File) =>
    run('Abriendo PDF…', async () => {
      const d = await loadPdfFile(file)
      setDoc(d)
      setPages(d.aspects.map((_, i) => ({ id: `${i}-${crypto.randomUUID()}`, index: i, rotation: 0 })))
      setSelected(new Set())
    })

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const rotateSelected = (deg: number) =>
    setPages((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, rotation: (p.rotation + deg + 360) % 360 } : p)))

  const deleteSelected = () => {
    if (selected.size === pages.length) {
      alert('El documento debe conservar al menos una página.')
      return
    }
    setPages((prev) => prev.filter((p) => !selected.has(p.id)))
    setSelected(new Set())
  }

  const unchanged = !!doc && pages.length === doc.aspects.length && pages.every((p, i) => p.index === i && p.rotation === 0)

  const save = () =>
    run('Guardando…', async () => {
      if (!doc) return
      const [blob] = await buildPdfs([doc.bytes], [pages.map((p) => ({ source: 0, page: p.index, rotate: p.rotation }))])
      const file = new File([blob], `${safeFileName(baseName(doc.file.name))} organizado.pdf`, { type: 'application/pdf' })
      setOutput({ file, thumb: await firstPageThumbnail(file) })
    })

  if (output) {
    return (
      <ExportView files={[output.file]} detail={pagesLabel(pages.length)} thumbUrl={output.thumb}
        back={{ onClick: () => { URL.revokeObjectURL(output.thumb); setOutput(null) }, label: 'Editar' }} />
    )
  }

  if (!doc) {
    return (
      <>
        <OpenPdfEmpty icon={LayoutGrid} color="--c-orange" title="Organizar páginas"
          text="Reordena, gira o elimina páginas. Mantén pulsada una página para moverla."
          onFiles={([f]) => void open(f)} />
        {busy && <Loading label={busy} />}
      </>
    )
  }

  const allSelected = selected.size === pages.length
  return (
    <div className="screen screen-fixed">
      <NavBar
        title={baseName(doc.file.name)}
        back={{ to: '/', label: 'Inicio' }}
        trailing={<button type="button" className="bar-button strong" disabled={unchanged} onClick={save}>Guardar</button>}
      />
      <main className="content scroll">
        <div className="grid-header">
          <span>{selected.size ? `${selected.size} seleccionadas` : 'Toca para seleccionar · mantén pulsado para mover'}</span>
          <button type="button" className="bar-button"
            onClick={() => setSelected(allSelected ? new Set() : new Set(pages.map((p) => p.id)))}>
            {allSelected ? 'Ninguna' : 'Todas'}
          </button>
        </div>
        <div className="tile-grid">
          {pages.map((p, i) => (
            <PageTile
              key={p.id}
              {...itemProps(i)}
              doc={doc.view}
              index={p.index}
              rotation={p.rotation}
              label={i + 1}
              selected={selected.has(p.id)}
              dragging={dragIndex === i}
              onClick={() => toggle(p.id)}
            />
          ))}
        </div>
      </main>
      <footer className="toolbar">
        <div className="toolbar-inner spread">
          <button type="button" className="icon-button" aria-label="Abrir otro PDF" onClick={() => fileInput.current?.click()}>
            <FileUp size={22} />
          </button>
          <button type="button" className="icon-button" aria-label="Girar a la izquierda" disabled={!selected.size}
            onClick={() => rotateSelected(-90)}>
            <RotateCcw size={22} />
          </button>
          <button type="button" className="icon-button" aria-label="Girar a la derecha" disabled={!selected.size}
            onClick={() => rotateSelected(90)}>
            <RotateCw size={22} />
          </button>
          <button type="button" className="icon-button destructive" aria-label="Eliminar" disabled={!selected.size}
            onClick={deleteSelected}>
            <Trash size={22} />
          </button>
        </div>
      </footer>
      <PdfInput inputRef={fileInput} onFiles={([f]) => void open(f)} />
      {busy && <Loading label={busy} />}
    </div>
  )
}
