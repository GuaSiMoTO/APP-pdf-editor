import { Image as ImageIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { baseName, safeFileName } from '../lib/pdfOps'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { OptionRow, Segmented } from '../ui/controls'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty } from '../ui/OpenPdfEmpty'
import { PageTile } from '../ui/PageTile'
import { useTask } from '../ui/useTask'

type Quality = '150' | '300'
/** Límite de píxeles por canvas en iOS (~16,7 MP); se deja margen. */
const MAX_PIXELS = 14_000_000

export default function PdfToImagesPage() {
  const [doc, setDoc] = useOpenPdf()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [quality, setQuality] = useState<Quality>('150')
  const [output, setOutput] = useState<{ files: File[]; thumb: string } | null>(null)
  const { busy, run } = useTask()
  const total = doc?.aspects.length ?? 0

  useEffect(() => () => {
    if (output) URL.revokeObjectURL(output.thumb)
  }, [output])

  const open = (file: File) =>
    run('Abriendo PDF…', async () => {
      const d = await loadPdfFile(file)
      setDoc(d)
      setSelected(new Set(d.aspects.map((_, i) => i))) // por defecto, todas
    })

  const convert = () =>
    run('Convirtiendo…', async () => {
      if (!doc) return
      const base = safeFileName(baseName(doc.file.name))
      const indices = [...selected].sort((a, b) => a - b)
      const files: File[] = []
      for (const i of indices) {
        const page = await doc.view.getPage(i + 1)
        const unit = page.getViewport({ scale: 1 })
        const scale = Math.min(Number(quality) / 72, Math.sqrt(MAX_PIXELS / (unit.width * unit.height)))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.floor(viewport.width)
        canvas.height = Math.floor(viewport.height)
        await page.render({ canvas, viewport }).promise
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
        canvas.width = canvas.height = 0 // libera memoria en iOS
        if (!blob) throw new Error(`No se pudo convertir la página ${i + 1}`)
        files.push(new File([blob], indices.length === 1 && total === 1 ? `${base}.jpg` : `${base} p${i + 1}.jpg`, { type: 'image/jpeg' }))
      }
      setOutput({ files, thumb: URL.createObjectURL(files[0]) })
    })

  if (output && doc) {
    return (
      <ExportView files={output.files} thumbUrl={output.thumb}
        title={output.files.length === 1 ? undefined : `${output.files.length} imágenes`}
        detail={`JPG · ${quality} ppp`}
        zipName={`${safeFileName(baseName(doc.file.name))} imágenes.zip`}
        back={{ onClick: () => setOutput(null), label: 'Editar' }} />
    )
  }

  if (!doc) {
    return (
      <>
        <OpenPdfEmpty icon={ImageIcon} color="--c-teal" title="PDF a imágenes"
          text="Convierte las páginas que elijas en imágenes JPG para guardarlas en Fotos o compartirlas."
          onFiles={([f]) => void open(f)} />
        {busy && <Loading label={busy} />}
      </>
    )
  }

  const all = selected.size === total
  return (
    <div className="screen screen-fixed">
      <NavBar title={baseName(doc.file.name)} back={{ to: '/', label: 'Inicio' }} />
      <main className="content scroll">
        <div className="list" style={{ marginTop: 12 }}>
          <OptionRow label="Calidad" stacked>
            <Segmented value={quality} onChange={setQuality}
              options={[{ id: '150', label: 'Normal · 150 ppp' }, { id: '300', label: 'Alta · 300 ppp' }]} />
          </OptionRow>
        </div>
        <div className="grid-header">
          <span>{selected.size} de {total} páginas</span>
          <button type="button" className="bar-button"
            onClick={() => setSelected(all ? new Set() : new Set(Array.from({ length: total }, (_, i) => i)))}>
            {all ? 'Ninguna' : 'Todas'}
          </button>
        </div>
        <div className="tile-grid">
          {doc.aspects.map((_, i) => (
            <PageTile key={i} doc={doc.view} index={i} label={i + 1} selected={selected.has(i)}
              onClick={() => setSelected((prev) => {
                const next = new Set(prev)
                if (next.has(i)) next.delete(i)
                else next.add(i)
                return next
              })} />
          ))}
        </div>
      </main>
      <footer className="toolbar">
        <div className="toolbar-inner">
          <button type="button" className="btn btn-primary" disabled={!selected.size} onClick={convert}>
            {selected.size === 1 ? 'Convertir 1 página' : `Convertir ${selected.size} páginas`}
          </button>
        </div>
      </footer>
      {busy && <Loading label={busy} />}
    </div>
  )
}
