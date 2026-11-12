import { ChevronRight } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import { useServerStatus, type ServerStatus } from './api'
import { TOOLS, type Tool } from './tools'
import { Loading } from './ui/Loading'
import { NavBar } from './ui/NavBar'

// Pantalla común de las herramientas del servidor (configuradas en ServerToolPage)
const ServerToolPage = lazy(() => import('./pages/ServerToolPage'))

// Cada herramienta se carga bajo demanda (el escáner arrastra OpenCV.js, ~13 MB).
const TOOL_PAGES: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  scan: lazy(() => import('./scan/ScanPage')),
  sign: lazy(() => import('./sign/SignPage')),
  merge: lazy(() => import('./pages/MergePage')),
  split: lazy(() => import('./pages/SplitPage')),
  organize: lazy(() => import('./pages/OrganizePage')),
  'jpg-to-pdf': lazy(() => import('./pages/ImagesToPdfPage')),
  'pdf-to-jpg': lazy(() => import('./pages/PdfToImagesPage')),
  watermark: lazy(() => import('./pages/WatermarkPage')),
  'page-numbers': lazy(() => import('./pages/PageNumbersPage')),
  annotate: lazy(() => import('./annotate/AnnotatePage')),
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tool/:id" element={<ToolRoute />} />
    </Routes>
  )
}

function Home() {
  const server = useServerStatus()
  const groups = [...new Set(TOOLS.map((t) => t.group))]

  return (
    <div className="screen">
      <NavBar transparent />
      <main className="content fade-in">
        <h1 className="large-title brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          {/* Logotipo "FOLIO" del logo original, coloreado por CSS según el tema */}
          <span className="wordmark" role="img" aria-label="Folio" />
        </h1>
        <span className={`status-dot${server.state === 'online' ? ' online' : ''}`}>
          {server.state === 'online' ? 'Conectado al PC' : server.state === 'offline' ? 'PC no disponible' : 'Conectando…'}
        </span>

        {groups.map((group) => (
          <section key={group}>
            <h2 className="section-header">{group}</h2>
            <div className="list">
              {TOOLS.filter((t) => t.group === group).map((tool) => (
                <ToolRow key={tool.id} tool={tool} server={server} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

function ToolRow({ tool, server }: { tool: Tool; server: ServerStatus }) {
  const Icon = tool.icon
  // Herramientas del servidor: necesitan el PC conectado y, algunas, Docker
  const badge = tool.where !== 'server' || server.state === 'checking'
    ? null
    : server.state === 'offline' ? 'Sin PC' : server.tools[tool.id] ? null : 'Docker'
  return (
    <Link to={`/tool/${tool.id}`} className={`row${badge ? ' dimmed-row' : ''}`}>
      <span className="row-icon" style={{ background: `var(${tool.color})` }}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="row-text">
        <span className="row-title">{tool.name}</span>
        <span className="row-detail">{tool.description}</span>
      </span>
      <span className="row-accessory">
        {!tool.ready && <span className="badge">Pronto</span>}
        {badge && <span className="badge">{badge}</span>}
        <ChevronRight size={18} strokeWidth={2.4} />
      </span>
    </Link>
  )
}

function ToolRoute() {
  const { id = '' } = useParams()
  const Page = TOOL_PAGES[id]
  if (Page) {
    return (
      <Suspense fallback={<Loading label="Cargando…" />}>
        <Page />
      </Suspense>
    )
  }
  const tool = TOOLS.find((t) => t.id === id)
  if (tool?.where === 'server' && tool.ready) {
    return (
      <Suspense fallback={<Loading label="Cargando…" />}>
        <ServerToolPage key={id} id={id} />
      </Suspense>
    )
  }
  return (
    <div className="screen">
      <NavBar title={tool?.name} back={{ to: '/', label: 'Inicio' }} />
      <main className="content">
        <div className="empty">
          <h2>Próximamente</h2>
          <p>Esta herramienta aún no está disponible.</p>
        </div>
      </main>
    </div>
  )
}
