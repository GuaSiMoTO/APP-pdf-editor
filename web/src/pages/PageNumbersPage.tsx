import { Hash } from 'lucide-react'
import { useState } from 'react'
import { firstPageThumbnail } from '../lib/pdfjs'
import { baseName, safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { applyTextMarks, numberMarks, type MarkStyle, type NumberOptions, type NumberPosition } from '../lib/textMarks'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { OptionRow, Segmented, Switch } from '../ui/controls'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { MarkPreview } from '../ui/MarkPreview'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty } from '../ui/OpenPdfEmpty'
import { useTask } from '../ui/useTask'

const STYLE: MarkStyle = { color: '#3a3a3c', opacity: 1, bold: false }
const POSITIONS: { id: NumberPosition; label: string }[] = [
  { id: 'tl', label: 'Arriba a la izquierda' }, { id: 'tc', label: 'Arriba en el centro' }, { id: 'tr', label: 'Arriba a la derecha' },
  { id: 'bl', label: 'Abajo a la izquierda' }, { id: 'bc', label: 'Abajo en el centro' }, { id: 'br', label: 'Abajo a la derecha' },
]

export default function PageNumbersPage() {
  const [doc, setDoc] = useOpenPdf()
  const [opts, setOpts] = useState<NumberOptions>({ position: 'bc', format: 'n', size: 'M', start: 1, skipFirst: false })
  const [output, setOutput] = useState<{ file: File; thumb: string } | null>(null)
  const { busy, run } = useTask()
  const set = (patch: Partial<NumberOptions>) => setOpts((o) => ({ ...o, ...patch }))
  const total = doc?.aspects.length ?? 0
  // La vista previa muestra la primera página que lleva número
  const previewIndex = opts.skipFirst && total > 1 ? 1 : 0

  const open = (file: File) => run('Abriendo PDF…', async () => setDoc(await loadPdfFile(file)))

  const apply = () =>
    run('Numerando…', async () => {
      if (!doc) return
      const blob = await applyTextMarks(doc.bytes, (W, H, i, n) => numberMarks(W, H, opts, i, n), STYLE)
      const file = new File([blob], `${safeFileName(baseName(doc.file.name))} numerado.pdf`, { type: 'application/pdf' })
      setOutput({ file, thumb: await firstPageThumbnail(file) })
    })

  if (output && doc) {
    return (
      <ExportView files={[output.file]} detail={pagesLabel(total)} thumbUrl={output.thumb}
        back={{ onClick: () => { URL.revokeObjectURL(output.thumb); setOutput(null) }, label: 'Editar' }} />
    )
  }

  if (!doc) {
    return (
      <>
        <OpenPdfEmpty icon={Hash} color="--c-purple" title="Numerar páginas"
          text="Añade números de página en la posición y el formato que prefieras."
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
        trailing={<button type="button" className="bar-button strong" onClick={apply}>Aplicar</button>}
      />
      <main className="content scroll">
        <MarkPreview doc={doc.view} index={previewIndex}
          marks={(W, H) => numberMarks(W, H, opts, previewIndex, total)} style={STYLE} maxHeight={320} />
        <p className="footnote center">Vista previa de la página {previewIndex + 1}</p>

        <h2 className="section-header">Posición</h2>
        <div className="list">
          <div className="row position-row">
            <div className="position-picker" role="radiogroup" aria-label="Posición del número">
              {POSITIONS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={opts.position === p.id} aria-label={p.label}
                  className={`pos-${p.id}`} onClick={() => set({ position: p.id })}>
                  <span />
                </button>
              ))}
            </div>
          </div>
        </div>

        <h2 className="section-header">Formato</h2>
        <div className="list">
          <OptionRow label="Texto" stacked>
            <Segmented value={opts.format} onChange={(format) => set({ format })}
              options={[{ id: 'n', label: '1' }, { id: 'n-of', label: '1 / 10' }, { id: 'page-n-of', label: 'Página 1 de 10' }]} />
          </OptionRow>
          <OptionRow label="Tamaño" stacked>
            <Segmented value={opts.size} onChange={(size) => set({ size })}
              options={[{ id: 'S', label: 'Pequeño' }, { id: 'M', label: 'Mediano' }, { id: 'L', label: 'Grande' }]} />
          </OptionRow>
          <OptionRow label="Empezar en">
            <input className="number-field" type="number" inputMode="numeric" min={0} max={9999} value={opts.start}
              onChange={(e) => set({ start: Math.max(0, Math.min(9999, Math.floor(Number(e.target.value) || 0))) })} />
          </OptionRow>
          <OptionRow label="Sin número en la portada">
            <Switch checked={opts.skipFirst} label="Sin número en la portada" onChange={(skipFirst) => set({ skipFirst })} />
          </OptionRow>
        </div>
      </main>
      {busy && <Loading label={busy} />}
    </div>
  )
}
