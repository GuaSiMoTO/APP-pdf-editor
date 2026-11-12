import { Stamp } from 'lucide-react'
import { useState } from 'react'
import { firstPageThumbnail } from '../lib/pdfjs'
import { baseName, safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { applyTextMarks, watermarkMarks, type MarkStyle, type WatermarkOptions } from '../lib/textMarks'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { ColorDots, OptionRow, Segmented, Slider } from '../ui/controls'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { MarkPreview } from '../ui/MarkPreview'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty } from '../ui/OpenPdfEmpty'
import { useTask } from '../ui/useTask'

const COLORS = [
  { color: '#8e8e93', label: 'Gris' },
  { color: '#ff3b30', label: 'Rojo' },
  { color: '#007aff', label: 'Azul' },
  { color: '#1c1c1e', label: 'Negro' },
]

export default function WatermarkPage() {
  const [doc, setDoc] = useOpenPdf()
  const [opts, setOpts] = useState<WatermarkOptions>({ text: 'CONFIDENCIAL', size: 'M', layout: 'center', diagonal: true })
  const [style, setStyle] = useState<MarkStyle>({ color: '#8e8e93', opacity: 0.3, bold: true })
  const [output, setOutput] = useState<{ file: File; thumb: string } | null>(null)
  const { busy, run } = useTask()
  const set = (patch: Partial<WatermarkOptions>) => setOpts((o) => ({ ...o, ...patch }))

  const open = (file: File) => run('Abriendo PDF…', async () => setDoc(await loadPdfFile(file)))

  const apply = () =>
    run('Aplicando…', async () => {
      if (!doc) return
      const blob = await applyTextMarks(doc.bytes, (W, H) => watermarkMarks(W, H, opts), style)
      const file = new File([blob], `${safeFileName(baseName(doc.file.name))} marca de agua.pdf`, { type: 'application/pdf' })
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
        <OpenPdfEmpty icon={Stamp} color="--c-purple" title="Marca de agua"
          text="Añade un texto como «CONFIDENCIAL» o «COPIA» sobre todas las páginas."
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
        trailing={<button type="button" className="bar-button strong" disabled={!opts.text.trim()} onClick={apply}>Aplicar</button>}
      />
      <main className="content scroll">
        <MarkPreview doc={doc.view} index={0} marks={(W, H) => watermarkMarks(W, H, opts)} style={style} maxHeight={320} />
        <p className="footnote center">Vista previa de la página 1 · se aplicará a {pagesLabel(doc.aspects.length)}</p>

        <h2 className="section-header">Texto</h2>
        <div className="list">
          <label className="row">
            <input className="text-field" value={opts.text} maxLength={40} onChange={(e) => set({ text: e.target.value })}
              placeholder="Texto de la marca" enterKeyHint="done" />
          </label>
        </div>

        <h2 className="section-header">Aspecto</h2>
        <div className="list">
          <OptionRow label="Tamaño" stacked>
            <Segmented value={opts.size} onChange={(size) => set({ size })}
              options={[{ id: 'S', label: 'Pequeño' }, { id: 'M', label: 'Mediano' }, { id: 'L', label: 'Grande' }]} />
          </OptionRow>
          <OptionRow label="Disposición" stacked>
            <Segmented value={opts.layout} onChange={(layout) => set({ layout })}
              options={[{ id: 'center', label: 'Centrada' }, { id: 'mosaic', label: 'Mosaico' }]} />
          </OptionRow>
          <OptionRow label="Orientación" stacked>
            <Segmented value={opts.diagonal ? 'd' : 'h'} onChange={(v) => set({ diagonal: v === 'd' })}
              options={[{ id: 'd', label: 'Diagonal' }, { id: 'h', label: 'Horizontal' }]} />
          </OptionRow>
          <OptionRow label="Color">
            <ColorDots value={style.color} colors={COLORS} onChange={(color) => setStyle((s) => ({ ...s, color }))} />
          </OptionRow>
          <OptionRow label="Opacidad" stacked>
            <Slider value={style.opacity} min={0.1} max={0.8} step={0.05} label="Opacidad"
              format={(v) => `${Math.round(v * 100)} %`} onChange={(opacity) => setStyle((s) => ({ ...s, opacity }))} />
          </OptionRow>
        </div>
      </main>
      {busy && <Loading label={busy} />}
    </div>
  )
}
