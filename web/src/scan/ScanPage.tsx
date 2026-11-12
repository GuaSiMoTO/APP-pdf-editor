import { Signature } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadOpenCv, type Cv } from '../lib/opencv'
import { jpegsToPdf } from '../lib/pdf'
import { safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { useTask } from '../ui/useTask'
import { applyFilter, detectDocument, warpDocument, type ScanFilter } from './detect'
import { defaultQuad } from './geometry'
import { loadImageFile, releaseCanvas, rotate, toJpeg } from './image'
import { defaultScanName, type Draft, type ScannedPage } from './scanTypes'
import { CropView, FilterView, PagesView } from './ScanViews'

const SOURCE_JPEG_QUALITY = 0.92

type View = 'pages' | 'crop' | 'filter' | 'export'

/** Deja que el navegador pinte (p. ej. el HUD) antes de un cálculo síncrono pesado. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

export default function ScanPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<View>('pages')
  const [pages, setPages] = useState<ScannedPage[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [warped, setWarped] = useState<HTMLCanvasElement | null>(null)
  const { busy, run } = useTask()
  const [name, setName] = useState(() => defaultScanName(new Date()))
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

  /** Descarta la página en edición liberando sus canvases. */
  const discardDraft = () => {
    releaseCanvas(draft?.source)
    releaseCanvas(warped)
    setWarped(null)
    setDraft(null)
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
      const next = warpDocument(await getCv(), draft.source, draft.quad)
      releaseCanvas(warped) // el de una pasada anterior por "Recortar"
      setWarped(next)
      setView('filter')
    })

  const result = useMemo(() => {
    if (!warped || !draft || !cv) return null
    const filtered = applyFilter(cv, warped, draft.filter)
    const rotated = rotate(filtered, draft.rotation)
    if (filtered !== warped && filtered !== rotated) releaseCanvas(filtered) // intermedio
    return rotated
  }, [cv, warped, draft])

  // Al cambiar de filtro o giro, liberar el resultado anterior (nunca el canvas enderezado)
  useEffect(() => () => {
    if (result && result !== warped) releaseCanvas(result)
  }, [result, warped])

  const savePage = () =>
    run('Guardando…', async () => {
      if (!draft || !result) return
      const jpeg = await toJpeg(result)
      const source = draft.sourceJpeg ?? (await toJpeg(draft.source, SOURCE_JPEG_QUALITY))
      const page: ScannedPage = {
        id: draft.editingId ?? crypto.randomUUID(),
        source,
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
      discardDraft()
      await openNextInQueue()
    })

  const cancelDraft = () => {
    const editing = !!draft?.editingId
    discardDraft()
    if (editing || queueRef.current.length === 0) setView('pages')
    else void run('Detectando documento…', openNextInQueue)
  }

  const editPage = (page: ScannedPage) =>
    run('Abriendo página…', async () => {
      const source = await loadImageFile(page.source)
      setDraft({ source, sourceJpeg: page.source, quad: page.quad, rotation: page.rotation, filter: page.filter, editingId: page.id })
      setView('crop')
    })

  const deletePage = (page: ScannedPage) => {
    URL.revokeObjectURL(page.url)
    setPages((prev) => prev.filter((p) => p.id !== page.id))
  }

  const createPdf = () =>
    run('Creando PDF…', async () => {
      const blob = await jpegsToPdf(pages.map((p) => p.jpeg), name)
      const fileName = `${safeFileName(name.trim() || defaultScanName(new Date()))}.pdf`
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
      <CropView draft={draft} onQuad={(quad) => setDraft({ ...draft, quad })}
        onCancel={cancelDraft} onNext={toFilter} overlay={hud} />
    )
  }

  if (view === 'filter' && draft && result) {
    return (
      <FilterView result={result} filter={draft.filter}
        onFilter={(filter: ScanFilter) => setDraft({ ...draft, filter })}
        onRotate={() => setDraft({ ...draft, rotation: draft.rotation + 1 })}
        onBack={() => setView('crop')} onSave={savePage} overlay={hud} />
    )
  }

  if (view === 'export' && pdf) {
    return (
      <ExportView
        files={[pdf]}
        detail={pagesLabel(pages.length)}
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
    <PagesView pages={pages} name={name} onName={setName} onEdit={editPage} onDelete={deletePage}
      onCamera={() => cameraInput.current?.click()} onLibrary={() => libraryInput.current?.click()}
      onCreate={createPdf}>
      {inputs}
      {hud}
    </PagesView>
  )
}
