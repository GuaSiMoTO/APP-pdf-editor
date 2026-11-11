import { Camera, Images, Plus, RotateCw, ScanLine, Signature, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadOpenCv, type Cv } from '../lib/opencv'
import { jpegsToPdf } from '../lib/pdf'
import { ExportView } from '../ui/ExportView'
import { FitCanvas } from '../ui/FitCanvas'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { CropEditor } from './CropEditor'
import { applyFilter, detectDocument, warpDocument, type ScanFilter } from './detect'
import { defaultQuad, type Quad } from './geometry'
import { loadImageFile, rotate, toJpeg } from './image'

/** Página ya escaneada. Se guarda la foto original y el recorte para poder re-editarla. */
interface ScannedPage {
  id: string
  source: HTMLCanvasElement
  quad: Quad
  rotation: number
  filter: ScanFilter
  jpeg: Blob
  url: string
}

/** Página en edición (recorte → filtro). */
interface Draft {
  source: HTMLCanvasElement
  quad: Quad
  rotation: number
  filter: ScanFilter
  editingId?: string
}

type View = 'pages' | 'crop' | 'filter' | 'export'

const FILTERS: { id: ScanFilter; label: string }[] = [
  { id: 'color', label: 'Color' },
  { id: 'gray', label: 'Grises' },
  { id: 'bw', label: 'Blanco y negro' },
]

/** Deja que el navegador pinte (p. ej. el HUD) antes de un cálculo síncrono pesado. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function defaultName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Escaneo ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`
}

export default function ScanPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('pages')
  const [pages, setPages] = useState<ScannedPage[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [warped, setWarped] = useState<HTMLCanvasElement | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [name, setName] = useState(defaultName)
  const [pdf, setPdf] = useState<File | null>(null)

  const [cv, setCv] = useState<Cv | null>(null)
  const queueRef = useRef<File[]>([])
  const lastFilterRef = useRef<ScanFilter>('color')
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  // Libera las URLs de miniaturas al salir
  const pagesRef = useRef(pages)
  useEffect(() => {
    pagesRef.current = pages
  }, [pages])
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label)
    try {
      await nextFrame()
      await task()
    } catch (err) {
      console.error(err)
      alert(`Algo ha fallado: ${(err as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  const getCv = async () => {
    const loaded = await loadOpenCv()
    setCv(loaded)
    return loaded
  }

  // ---------- Entrada de fotos ----------

  const openNextInQueue = async () => {
    const file = queueRef.current.shift()
    if (!file) {
      setDraft(null)
      setView('pages')
      return
    }
    const cvInstance = await getCv()
    const source = await loadImageFile(file)
    await nextFrame()
    const quad = detectDocument(cvInstance, source) ?? defaultQuad(source.width, source.height)
    setDraft({ source, quad, rotation: 0, filter: lastFilterRef.current })
    setView('crop')
  }

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return
    queueRef.current.push(...Array.from(files))
    void run(cv ? 'Detectando documento…' : 'Preparando escáner…', openNextInQueue)
  }

  // ---------- Recorte → filtro → guardar ----------

  const toFilter = () =>
    run('Enderezando…', async () => {
      if (!draft) return
      setWarped(warpDocument(await getCv(), draft.source, draft.quad))
      setView('filter')
    })

  const result = useMemo(() => {
    if (!warped || !draft || !cv) return null
    return rotate(applyFilter(cv, warped, draft.filter), draft.rotation)
  }, [cv, warped, draft])

  const savePage = () =>
    run('Guardando…', async () => {
      if (!draft || !result) return
      const jpeg = await toJpeg(result)
      const page: ScannedPage = {
        id: draft.editingId ?? crypto.randomUUID(),
        source: draft.source,
        quad: draft.quad,
        rotation: draft.rotation,
        filter: draft.filter,
        jpeg,
        url: URL.createObjectURL(jpeg),
      }
      lastFilterRef.current = draft.filter
      setPages((prev) => {
        const old = prev.find((p) => p.id === page.id)
        if (!old) return [...prev, page]
        URL.revokeObjectURL(old.url)
        return prev.map((p) => (p.id === page.id ? page : p))
      })
      setWarped(null)
      await openNextInQueue()
    })

  const cancelDraft = () => {
    setWarped(null)
    if (draft?.editingId || queueRef.current.length === 0) {
      setDraft(null)
      setView('pages')
    } else {
      void run('Detectando documento…', openNextInQueue)
    }
  }

  const editPage = (page: ScannedPage) => {
    setDraft({ source: page.source, quad: page.quad, rotation: page.rotation, filter: page.filter, editingId: page.id })
    setView('crop')
  }

  const deletePage = (page: ScannedPage) => {
    URL.revokeObjectURL(page.url)
    setPages((prev) => prev.filter((p) => p.id !== page.id))
  }

  const createPdf = () =>
    run('Creando PDF…', async () => {
      const blob = await jpegsToPdf(pages.map((p) => p.jpeg), name)
      const fileName = `${name.trim() || defaultName()}.pdf`.replace(/[\\/:*?"<>|]/g, '-')
      setPdf(new File([blob], fileName, { type: 'application/pdf' }))
      setView('export')
    })

  // ---------- Render ----------

  const inputs = (
    <>
      <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment"
        onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
      <input ref={libraryInput} className="visually-hidden" type="file" accept="image/*" multiple
        onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
    </>
  )
  const hud = busy && <Loading label={busy} />

  if (view === 'crop' && draft) {
    return (
      <div className="screen screen-fixed">
        <NavBar
          title="Ajustar bordes"
          back={{ onClick: cancelDraft, label: 'Cancelar' }}
          trailing={<button type="button" className="bar-button strong" onClick={toFilter}>Siguiente</button>}
        />
        <div className="stage">
          <CropEditor source={draft.source} quad={draft.quad} onChange={(quad) => setDraft({ ...draft, quad })} />
        </div>
        <footer className="toolbar">
          <div className="toolbar-inner hint">Arrastra las esquinas para ajustar el recorte</div>
        </footer>
        {hud}
      </div>
    )
  }

  if (view === 'filter' && draft && result) {
    return (
      <div className="screen screen-fixed">
        <NavBar
          title="Página"
          back={{ onClick: () => setView('crop'), label: 'Recortar' }}
          trailing={<button type="button" className="bar-button strong" onClick={savePage}>Guardar</button>}
        />
        <div className="stage">
          <FitCanvas source={result} className="page-shadow" />
        </div>
        <footer className="toolbar">
          <div className="toolbar-inner">
            <div className="segmented" style={{ flex: 1 }}>
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={draft.filter === f.id}
                  onClick={() => setDraft({ ...draft, filter: f.id })}>
                  {f.label}
                </button>
              ))}
            </div>
            <button type="button" className="icon-button" aria-label="Girar"
              onClick={() => setDraft({ ...draft, rotation: draft.rotation + 1 })}>
              <RotateCw size={22} />
            </button>
          </div>
        </footer>
        {hud}
      </div>
    )
  }

  if (view === 'export' && pdf) {
    return (
      <ExportView
        file={pdf}
        pageCount={pages.length}
        thumbUrl={pages[0]?.url}
        back={{ onClick: () => setView('pages'), label: 'Editar' }}
        extraActions={
          <button type="button" className="btn btn-secondary btn-block"
            onClick={() => navigate('/tool/sign', { state: { file: pdf } })}>
            <Signature size={20} /> Firmar
          </button>
        }
      />
    )
  }

  // Vista de páginas (o estado vacío)
  return (
    <div className="screen screen-fixed">
      <NavBar title={pages.length ? 'Escaneo' : undefined} back={{ to: '/', label: 'Inicio' }} />
      {pages.length === 0 ? (
        <main className="content fade-in">
          <div className="empty">
            <div className="empty-icon" style={{ background: 'var(--c-blue)' }}>
              <ScanLine size={44} strokeWidth={1.8} />
            </div>
            <h2>Escanear documento</h2>
            <p>Haz una foto de cada página. Detectamos los bordes y la enderezamos automáticamente.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-block" onClick={() => cameraInput.current?.click()}>
                <Camera size={20} /> Hacer foto
              </button>
              <button type="button" className="btn btn-secondary btn-block" onClick={() => libraryInput.current?.click()}>
                <Images size={20} /> Elegir de Fotos
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          <main className="content scroll fade-in">
            <h2 className="section-header">Nombre</h2>
            <div className="list">
              <label className="row">
                <input className="text-field" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del documento" enterKeyHint="done" />
              </label>
            </div>

            <h2 className="section-header">
              {pages.length} {pages.length === 1 ? 'página' : 'páginas'} · Toca una para editarla
            </h2>
            <div className="pages-grid">
              {pages.map((page, i) => (
                <div key={page.id} className="page-tile">
                  <button type="button" className="page-thumb" onClick={() => editPage(page)}>
                    <img src={page.url} alt={`Página ${i + 1}`} />
                  </button>
                  <button type="button" className="page-delete" aria-label={`Eliminar página ${i + 1}`}
                    onClick={() => deletePage(page)}>
                    <X size={14} strokeWidth={3} />
                  </button>
                  <span className="page-number">{i + 1}</span>
                </div>
              ))}
              <button type="button" className="page-add" onClick={() => cameraInput.current?.click()} aria-label="Añadir página">
                <Plus size={28} />
              </button>
            </div>
          </main>
          <footer className="toolbar">
            <div className="toolbar-inner">
              <button type="button" className="icon-button" aria-label="Elegir de Fotos" onClick={() => libraryInput.current?.click()}>
                <Images size={22} />
              </button>
              <button type="button" className="icon-button" aria-label="Hacer foto" onClick={() => cameraInput.current?.click()}>
                <Camera size={22} />
              </button>
              <button type="button" className="btn btn-primary" onClick={createPdf}>
                Crear PDF
              </button>
            </div>
          </footer>
        </>
      )}
      {inputs}
      {hud}
    </div>
  )
}
