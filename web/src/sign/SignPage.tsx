import { FileUp, Plus, Signature, Trash } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { firstPageThumbnail } from '../lib/pdfjs'
import { pagesLabel } from '../lib/share'
import { loadSignatures, storeSignatures, type SavedSignature } from '../lib/signatures'
import { loadPdfFile, useOpenPdf } from '../lib/usePdf'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { Sheet } from '../ui/Sheet'
import { useElementSize } from '../ui/useElementSize'
import { useTask } from '../ui/useTask'
import { PageView } from './PageView'
import { SignaturePad } from './SignaturePad'
import { stampSignatures, type Placement } from './stamp'

const PAGE_GAP = 16
const DEFAULT_NW = 0.32

export default function SignPage() {
  const location = useLocation()
  const [doc, setDoc] = useOpenPdf()
  const [placements, setPlacements] = useState<Placement[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [signatures, setSignatures] = useState<SavedSignature[]>(loadSignatures)
  const [sheet, setSheet] = useState(false)
  const [pad, setPad] = useState(false)
  const { busy, run } = useTask()
  const [output, setOutput] = useState<{ file: File; thumb: string } | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const size = useElementSize(scrollRef)
  const pageWidth = size ? Math.min(size.width - 32, 760) : 0

  const open = (file: File) =>
    run('Abriendo PDF…', async () => {
      setDoc(await loadPdfFile(file))
      setPlacements([])
      setOutput(null)
    })

  // PDF recibido desde otra herramienta (p. ej. "Firmar" tras escanear)
  useEffect(() => {
    const incoming = (location.state as { file?: File } | null)?.file
    if (incoming) void open(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- Firmas ----------

  /** Página más centrada en pantalla, para colocar ahí la firma nueva. */
  const currentPage = (): number => {
    const scroller = scrollRef.current
    if (!scroller) return 0
    const mid = window.innerHeight / 2
    let best = 0
    let bestDist = Infinity
    scroller.querySelectorAll<HTMLElement>('[data-page]').forEach((el) => {
      const r = el.getBoundingClientRect()
      const d = Math.abs((r.top + r.bottom) / 2 - mid)
      if (d < bestDist) { bestDist = d; best = Number(el.dataset.page) }
    })
    return best
  }

  const place = (sig: SavedSignature) => {
    if (!doc) return
    const page = currentPage()
    const aspect = sig.height / sig.width
    const pageAspect = doc.aspects[page]
    const nw = Math.min(DEFAULT_NW, 0.9 / (aspect / pageAspect))
    const nh = (nw * aspect) / pageAspect
    const p: Placement = {
      id: crypto.randomUUID(), page, signatureId: sig.id, dataUrl: sig.dataUrl,
      nx: (1 - nw) / 2, ny: (1 - nh) / 2, nw, aspect,
    }
    setPlacements((prev) => [...prev, p])
    setSelectedId(p.id)
    setSheet(false)
  }

  const saveNewSignature = (png: { dataUrl: string; width: number; height: number }) => {
    const sig: SavedSignature = { id: crypto.randomUUID(), createdAt: Date.now(), ...png }
    const list = [sig, ...signatures]
    setSignatures(list)
    storeSignatures(list)
    setPad(false)
    place(sig)
  }

  const deleteSignature = (id: string) => {
    const list = signatures.filter((s) => s.id !== id)
    setSignatures(list)
    storeSignatures(list)
  }

  const addSignature = () => (signatures.length ? setSheet(true) : setPad(true))

  const finish = () =>
    run('Firmando…', async () => {
      if (!doc) return
      const blob = await stampSignatures(doc.bytes, doc.view, placements)
      const name = doc.file.name.replace(/\.pdf$/i, '') + ' firmado.pdf'
      const file = new File([blob], name, { type: 'application/pdf' })
      setOutput({ file, thumb: await firstPageThumbnail(file) })
    })

  // ---------- Render ----------

  const input = (
    <input ref={fileInput} className="visually-hidden" type="file" accept="application/pdf,.pdf"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) void open(f); e.target.value = '' }} />
  )
  const hud = busy && <Loading label={busy} />

  if (output && doc) {
    return (
      <ExportView
        files={[output.file]}
        detail={pagesLabel(doc.aspects.length)}
        thumbUrl={output.thumb}
        back={{ onClick: () => { URL.revokeObjectURL(output.thumb); setOutput(null) }, label: 'Editar' }}
      />
    )
  }

  if (pad) {
    return <SignaturePad onCancel={() => setPad(false)} onDone={saveNewSignature} />
  }

  if (!doc) {
    return (
      <div className="screen screen-fixed">
        <NavBar back={{ to: '/', label: 'Inicio' }} />
        <main className="content fade-in">
          <div className="empty">
            <div className="empty-icon" style={{ background: 'var(--c-indigo)' }}>
              <Signature size={44} strokeWidth={1.8} />
            </div>
            <h2>Firmar documento</h2>
            <p>Abre un PDF, dibuja tu firma y colócala donde quieras. Tus firmas se guardan en este dispositivo.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-block" onClick={() => fileInput.current?.click()}>
                <FileUp size={20} /> Elegir PDF
              </button>
            </div>
          </div>
        </main>
        {input}
        {hud}
      </div>
    )
  }

  return (
    <div className="screen screen-fixed">
      <NavBar
        title={doc.file.name.replace(/\.pdf$/i, '')}
        back={{ to: '/', label: 'Inicio' }}
        trailing={
          <button type="button" className="bar-button strong" disabled={placements.length === 0} onClick={finish}>
            Guardar
          </button>
        }
      />
      <div ref={scrollRef} className="pdf-scroll" onPointerDown={() => setSelectedId(null)}>
        {pageWidth > 0 &&
          doc.aspects.map((aspect, i) => (
            <div key={i} style={{ marginBottom: PAGE_GAP }}>
              <PageView
                doc={doc.view}
                index={i}
                width={pageWidth}
                aspect={aspect}
                placements={placements.filter((p) => p.page === i)}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={(p) => setPlacements((prev) => prev.map((q) => (q.id === p.id ? p : q)))}
                onDelete={(id) => setPlacements((prev) => prev.filter((q) => q.id !== id))}
              />
              <div className="page-caption">{i + 1} de {doc.aspects.length}</div>
            </div>
          ))}
      </div>
      <footer className="toolbar">
        <div className="toolbar-inner">
          <button type="button" className="icon-button" aria-label="Abrir otro PDF" onClick={() => fileInput.current?.click()}>
            <FileUp size={22} />
          </button>
          <button type="button" className="btn btn-primary" onClick={addSignature}>
            <Signature size={20} /> Añadir firma
          </button>
        </div>
      </footer>

      {sheet && (
        <Sheet title="Mis firmas" onClose={() => setSheet(false)}>
          <div className="list">
            {signatures.map((s) => (
              <div key={s.id} className="row sig-row">
                <button type="button" className="sig-preview" onClick={() => place(s)} aria-label="Usar esta firma">
                  <img src={s.dataUrl} alt="" />
                </button>
                <button type="button" className="icon-button destructive" aria-label="Eliminar firma"
                  onClick={() => deleteSignature(s.id)}>
                  <Trash size={20} />
                </button>
              </div>
            ))}
            <button type="button" className="row" onClick={() => { setSheet(false); setPad(true) }}>
              <span className="row-icon" style={{ background: 'var(--c-indigo)' }}><Plus size={18} /></span>
              <span className="row-text"><span className="row-title" style={{ color: 'var(--tint)' }}>Nueva firma</span></span>
            </button>
          </div>
        </Sheet>
      )}
      {input}
      {hud}
    </div>
  )
}
