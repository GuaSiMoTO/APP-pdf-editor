import { FilePlus, GripVertical, Merge, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { closePdf, firstPageThumbnail } from '../lib/pdfjs'
import { baseName, buildPdfs, safeFileName } from '../lib/pdfOps'
import { formatBytes, pagesLabel } from '../lib/share'
import { loadPdfFile, type OpenPdf } from '../lib/usePdf'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty, PdfInput } from '../ui/OpenPdfEmpty'
import { PageThumb } from '../ui/PageThumb'
import { useSortable } from '../ui/useSortable'
import { useTask } from '../ui/useTask'

interface Item {
  id: string
  pdf: OpenPdf
}

export default function MergePage() {
  const [items, setItems] = useState<Item[]>([])
  const [output, setOutput] = useState<{ file: File; thumb: string; pages: number } | null>(null)
  const { busy, run } = useTask()
  const fileInput = useRef<HTMLInputElement>(null)
  // En listas el arrastre empieza desde el tirador (≡), sin pulsación larga
  const { itemProps, dragIndex } = useSortable(items, setItems, { longPress: false })

  // Liberar todos los documentos al salir
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => () => itemsRef.current.forEach((i) => void closePdf(i.pdf.view)), [])

  const add = (files: File[]) =>
    run(files.length > 1 ? 'Abriendo PDFs…' : 'Abriendo PDF…', async () => {
      const loaded: Item[] = []
      for (const f of files) loaded.push({ id: crypto.randomUUID(), pdf: await loadPdfFile(f) })
      setItems((prev) => [...prev, ...loaded])
    })

  const remove = (item: Item) => {
    void closePdf(item.pdf.view)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  const totalPages = items.reduce((n, i) => n + i.pdf.aspects.length, 0)

  const merge = () =>
    run('Uniendo…', async () => {
      const [blob] = await buildPdfs(
        items.map((i) => i.pdf.bytes),
        [items.flatMap((it, s) => it.pdf.aspects.map((_, page) => ({ source: s, page })))],
      )
      const name = `${safeFileName(baseName(items[0].pdf.file.name))} (unido).pdf`
      const file = new File([blob], name, { type: 'application/pdf' })
      setOutput({ file, thumb: await firstPageThumbnail(file), pages: totalPages })
    })

  if (output) {
    return (
      <ExportView files={[output.file]} detail={pagesLabel(output.pages)} thumbUrl={output.thumb}
        back={{ onClick: () => { URL.revokeObjectURL(output.thumb); setOutput(null) }, label: 'Editar' }} />
    )
  }

  if (!items.length) {
    return (
      <>
        <OpenPdfEmpty icon={Merge} color="--c-orange" title="Unir PDF" multiple buttonLabel="Elegir PDFs"
          text="Elige dos o más PDF y ordénalos arrastrando el tirador. Se unirán en un solo documento."
          onFiles={(f) => void add(f)} />
        {busy && <Loading label={busy} />}
      </>
    )
  }

  return (
    <div className="screen screen-fixed">
      <NavBar
        title="Unir PDF"
        back={{ to: '/', label: 'Inicio' }}
        trailing={<button type="button" className="bar-button strong" disabled={items.length < 2} onClick={merge}>Unir</button>}
      />
      <main className="content scroll">
        <h2 className="section-header">
          {items.length} {items.length === 1 ? 'archivo' : 'archivos'} · {pagesLabel(totalPages)}
        </h2>
        <div className="list">
          {items.map((it, i) => (
            <div key={it.id} {...itemProps(i)} className={`row merge-row${dragIndex === i ? ' dragging' : ''}`}>
              <span className="merge-thumb"><PageThumb doc={it.pdf.view} index={0} /></span>
              <span className="row-text">
                <span className="row-title ellipsis">{baseName(it.pdf.file.name)}</span>
                <span className="row-detail">{pagesLabel(it.pdf.aspects.length)} · {formatBytes(it.pdf.file.size)}</span>
              </span>
              <button type="button" className="icon-button muted" aria-label="Quitar" onClick={() => remove(it)}>
                <X size={18} />
              </button>
              <span className="drag-handle" data-drag-handle aria-label="Mover">
                <GripVertical size={20} />
              </span>
            </div>
          ))}
        </div>
        {items.length < 2 && <p className="footnote">Añade al menos otro PDF para unirlos.</p>}
      </main>
      <footer className="toolbar">
        <div className="toolbar-inner">
          <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
            <FilePlus size={20} /> Añadir PDF
          </button>
        </div>
      </footer>
      <PdfInput inputRef={fileInput} multiple onFiles={(f) => void add(f)} />
      {busy && <Loading label={busy} />}
    </div>
  )
}
