import { FileUp, Split } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { baseName, buildPdfs, parseRanges, rangeLabel, safeFileName } from '../lib/pdfOps'
import { firstPageThumbnail } from '../lib/pdfjs'
import { pagesLabel } from '../lib/share'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { OpenPdfEmpty, PdfInput } from '../ui/OpenPdfEmpty'
import { PageTile } from '../ui/PageTile'
import { useTask } from '../ui/useTask'

type Mode = 'select' | 'ranges' | 'each'

const MODES: { id: Mode; label: string }[] = [
  { id: 'select', label: 'Extraer' },
  { id: 'ranges', label: 'Por rangos' },
  { id: 'each', label: 'Cada página' },
]

export default function SplitPage() {
  const [doc, setDoc] = useOpenPdf()
  const [mode, setMode] = useState<Mode>('select')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [ranges, setRanges] = useState('')
  const [output, setOutput] = useState<{ files: File[]; thumb?: string; detail: string } | null>(null)
  const { busy, run } = useTask()
  const fileInput = useRef<HTMLInputElement>(null)
  const pageCount = doc?.aspects.length ?? 0

  const open = (file: File) =>
    run('Abriendo PDF…', async () => {
      const d = await loadPdfFile(file)
      setDoc(d)
      setSelected(new Set())
      setRanges(d.aspects.length > 1 ? `1-${Math.ceil(d.aspects.length / 2)}, ${Math.ceil(d.aspects.length / 2) + 1}-${d.aspects.length}` : '1')
    })

  // Grupos de páginas que se generarán según el modo
  const plan = useMemo((): { groups: number[][]; error?: string } => {
    if (mode === 'select') return { groups: selected.size ? [[...selected].sort((a, b) => a - b)] : [] }
    if (mode === 'each') return { groups: Array.from({ length: pageCount }, (_, i) => [i]) }
    try {
      return { groups: parseRanges(ranges, pageCount) }
    } catch (err) {
      return { groups: [], error: (err as Error).message }
    }
  }, [mode, selected, ranges, pageCount])

  // Para colorear las páginas según el archivo al que irán (modo rangos)
  const groupOf = useMemo(() => {
    const m = new Map<number, number>()
    if (mode === 'ranges') plan.groups.forEach((g, gi) => g.forEach((p) => m.set(p, gi)))
    return m
  }, [mode, plan])

  const split = () =>
    run('Dividiendo…', async () => {
      if (!doc) return
      const blobs = await buildPdfs([doc.bytes], plan.groups.map((g) => g.map((page) => ({ source: 0, page }))))
      const base = safeFileName(baseName(doc.file.name))
      const files = blobs.map((b, i) => {
        const g = plan.groups[i]
        const suffix = mode === 'select' ? 'extracto' : `p${rangeLabel(g)}`
        return new File([b], `${base} ${suffix}.pdf`, { type: 'application/pdf' })
      })
      const thumb = files.length === 1 ? await firstPageThumbnail(files[0]) : undefined
      const detail = files.length === 1 ? pagesLabel(plan.groups[0].length) : `${files.length} archivos`
      setOutput({ files, thumb, detail })
    })

  if (output && doc) {
    return (
      <ExportView files={output.files} detail={output.detail} thumbUrl={output.thumb}
        zipName={`${safeFileName(baseName(doc.file.name))} dividido.zip`}
        back={{ onClick: () => { if (output.thumb) URL.revokeObjectURL(output.thumb); setOutput(null) }, label: 'Editar' }} />
    )
  }

  if (!doc) {
    return (
      <>
        <OpenPdfEmpty icon={Split} color="--c-orange" title="Dividir PDF"
          text="Extrae las páginas que elijas, separa el documento por rangos o crea un PDF por página."
          onFiles={([f]) => void open(f)} />
        {busy && <Loading label={busy} />}
      </>
    )
  }

  const n = plan.groups.length
  const actionLabel = mode === 'select'
    ? selected.size ? `Extraer ${pagesLabel(selected.size)}` : 'Selecciona páginas'
    : n ? `Crear ${n} ${n === 1 ? 'archivo' : 'archivos'}` : 'Dividir'

  return (
    <div className="screen screen-fixed">
      <NavBar title={baseName(doc.file.name)} back={{ to: '/', label: 'Inicio' }} />
      <main className="content scroll">
        <div className="segmented mode-switch">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>

        {mode === 'select' && (
          <div className="grid-header">
            <span>{selected.size ? `${selected.size} de ${pageCount} seleccionadas` : 'Toca las páginas que quieres extraer'}</span>
            <button type="button" className="bar-button"
              onClick={() => setSelected(selected.size === pageCount ? new Set() : new Set(Array.from({ length: pageCount }, (_, i) => i)))}>
              {selected.size === pageCount ? 'Ninguna' : 'Todas'}
            </button>
          </div>
        )}

        {mode === 'ranges' && (
          <>
            <h2 className="section-header">Rangos</h2>
            <div className="list">
              <label className="row">
                <input className="text-field" value={ranges} onChange={(e) => setRanges(e.target.value)}
                  placeholder="Ej.: 1-3, 4, 5-8" inputMode="text" autoCapitalize="off" autoCorrect="off" enterKeyHint="done" />
              </label>
            </div>
            <p className={`footnote${plan.error ? ' error' : ''}`}>
              {plan.error ?? `Cada rango será un PDF: ${plan.groups.map((g) => rangeLabel(g)).join(' · ')}`}
            </p>
          </>
        )}

        {mode === 'each' && <p className="footnote">Se creará un PDF por cada una de las {pageCount} páginas.</p>}

        <div className="tile-grid">
          {doc.aspects.map((_, i) => {
            const g = groupOf.get(i)
            return (
              <PageTile
                key={i}
                doc={doc.view}
                index={i}
                label={mode === 'ranges' && g !== undefined ? <span className="group-chip" data-group={g % 6}>{i + 1}</span> : i + 1}
                selected={mode === 'select' ? selected.has(i) : undefined}
                dimmed={mode === 'ranges' && g === undefined}
                onClick={mode === 'select' ? () => setSelected((prev) => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                }) : undefined}
              />
            )
          })}
        </div>
      </main>
      <footer className="toolbar">
        <div className="toolbar-inner">
          <button type="button" className="icon-button" aria-label="Abrir otro PDF" onClick={() => fileInput.current?.click()}>
            <FileUp size={22} />
          </button>
          <button type="button" className="btn btn-primary" disabled={!n} onClick={split}>{actionLabel}</button>
        </div>
      </footer>
      <PdfInput inputRef={fileInput} onFiles={([f]) => void open(f)} />
      {busy && <Loading label={busy} />}
    </div>
  )
}
