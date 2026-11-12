import { Images, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { jpegsToPdf } from '../lib/pdf'
import { safeFileName } from '../lib/pdfOps'
import { pagesLabel } from '../lib/share'
import { createCanvas, loadImageFile, toJpeg } from '../scan/image'
import { OptionRow, Segmented } from '../ui/controls'
import { ExportView } from '../ui/ExportView'
import { Loading } from '../ui/Loading'
import { NavBar } from '../ui/NavBar'
import { useSortable } from '../ui/useSortable'
import { useTask } from '../ui/useTask'

interface Img {
  id: string
  jpeg: Blob
  url: string
}

type Margin = 'none' | 'S' | 'L'
const MARGIN_PT: Record<Margin, number> = { none: 0, S: 20, L: 40 }

/** Decodifica cualquier imagen que Safari sepa leer (HEIC, PNG, WebP...) y la pasa a JPEG
 *  sobre fondo blanco (las transparencias en JPEG saldrían negras). */
async function toPageJpeg(file: File): Promise<Blob> {
  const src = await loadImageFile(file)
  const flat = createCanvas(src.width, src.height)
  const ctx = flat.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(src, 0, 0)
  return toJpeg(flat, 0.88)
}

export default function ImagesToPdfPage() {
  const [images, setImages] = useState<Img[]>([])
  const [pageSize, setPageSize] = useState<'fit' | 'a4'>('a4')
  const [margin, setMargin] = useState<Margin>('S')
  const [output, setOutput] = useState<{ file: File } | null>(null)
  const { busy, run } = useTask()
  const input = useRef<HTMLInputElement>(null)
  const { itemProps, dragIndex } = useSortable(images, setImages)

  const imagesRef = useRef(images)
  useEffect(() => {
    imagesRef.current = images
  }, [images])
  useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  const add = (files: File[]) =>
    run(files.length > 1 ? `Preparando ${files.length} imágenes…` : 'Preparando imagen…', async () => {
      const added: Img[] = []
      for (const f of files) {
        const jpeg = await toPageJpeg(f)
        added.push({ id: crypto.randomUUID(), jpeg, url: URL.createObjectURL(jpeg) })
      }
      setImages((prev) => [...prev, ...added])
    })

  const remove = (img: Img) => {
    URL.revokeObjectURL(img.url)
    setImages((prev) => prev.filter((i) => i.id !== img.id))
  }

  const create = () =>
    run('Creando PDF…', async () => {
      const name = safeFileName(`Imágenes ${new Date().toLocaleDateString('es-ES').replace(/\//g, '-')}`)
      const blob = await jpegsToPdf(images.map((i) => i.jpeg), name, { pageSize, margin: MARGIN_PT[margin] })
      setOutput({ file: new File([blob], `${name}.pdf`, { type: 'application/pdf' }) })
    })

  const fileInput = (
    <input ref={input} className="visually-hidden" type="file" accept="image/*" multiple
      onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) void add(f) }} />
  )

  if (output) {
    return (
      <ExportView files={[output.file]} detail={pagesLabel(images.length)} thumbUrl={images[0]?.url}
        back={{ onClick: () => setOutput(null), label: 'Editar' }} />
    )
  }

  if (!images.length) {
    return (
      <div className="screen screen-fixed">
        <NavBar back={{ to: '/', label: 'Inicio' }} />
        <main className="content fade-in">
          <div className="empty">
            <div className="empty-icon" style={{ background: 'var(--c-teal)' }}>
              <Images size={44} strokeWidth={1.8} />
            </div>
            <h2>Imágenes a PDF</h2>
            <p>Elige fotos o imágenes (JPG, PNG, HEIC…). Cada una será una página; podrás ordenarlas.</p>
            <div className="actions">
              <button type="button" className="btn btn-primary btn-block" onClick={() => input.current?.click()}>
                <Images size={20} /> Elegir imágenes
              </button>
            </div>
          </div>
        </main>
        {fileInput}
        {busy && <Loading label={busy} />}
      </div>
    )
  }

  return (
    <div className="screen screen-fixed">
      <NavBar
        title="Imágenes a PDF"
        back={{ to: '/', label: 'Inicio' }}
        trailing={<button type="button" className="bar-button strong" onClick={create}>Crear PDF</button>}
      />
      <main className="content scroll">
        <h2 className="section-header">{pagesLabel(images.length)} · mantén pulsada para mover</h2>
        <div className="pages-grid">
          {images.map((img, i) => (
            <div key={img.id} {...itemProps(i)} className={`page-tile tile${dragIndex === i ? ' dragging' : ''}`}>
              <div className="page-thumb">
                <img src={img.url} alt={`Imagen ${i + 1}`} draggable={false} />
              </div>
              <button type="button" className="page-delete" aria-label={`Quitar imagen ${i + 1}`}
                onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(img)}>
                <X size={14} strokeWidth={3} />
              </button>
              <span className="page-number">{i + 1}</span>
            </div>
          ))}
          <button type="button" className="page-add" onClick={() => input.current?.click()} aria-label="Añadir imágenes">
            <Plus size={28} />
          </button>
        </div>

        <h2 className="section-header">Página</h2>
        <div className="list">
          <OptionRow label="Tamaño" stacked>
            <Segmented value={pageSize} onChange={setPageSize}
              options={[{ id: 'a4', label: 'A4' }, { id: 'fit', label: 'Ajustada a la imagen' }]} />
          </OptionRow>
          {pageSize === 'a4' && (
            <OptionRow label="Márgenes" stacked>
              <Segmented value={margin} onChange={setMargin}
                options={[{ id: 'none', label: 'Sin margen' }, { id: 'S', label: 'Pequeños' }, { id: 'L', label: 'Grandes' }]} />
            </OptionRow>
          )}
        </div>
      </main>
      {fileInput}
      {busy && <Loading label={busy} />}
    </div>
  )
}
