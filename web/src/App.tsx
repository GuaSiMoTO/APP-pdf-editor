import { ChevronRight } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, Route, Routes, useParams } from 'react-router-dom'
import { useServerStatus } from './api'
import { TOOLS, type Tool } from './tools'
import { Loading } from './ui/Loading'
import { NavBar } from './ui/NavBar'

// Cada herramienta se carga bajo demanda (el escáner arrastra OpenCV.js, ~13 MB).
const TOOL_PAGES: Record<string, React.LazyExoticComponent<() => React.JSX.Element>> = {
  scan: lazy(() => import('./scan/ScanPage')),
  sign: lazy(() => import('./sign/SignPage')),
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
        <h1 className="large-title">Documentos</h1>
        <span className={`status-dot${server === 'online' ? ' online' : ''}`}>
          {server === 'online' ? 'Conectado al PC' : server === 'offline' ? 'PC no disponible' : 'Conectando…'}
        </span>

        {groups.map((group) => (
          <section key={group}>
            <h2 className="section-header">{group}</h2>
            <div className="list">
              {TOOLS.filter((t) => t.group === group).map((tool) => (
                <ToolRow key={tool.id} tool={tool} serverOnline={server === 'online'} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

function ToolRow({ tool, serverOnline }: { tool: Tool; serverOnline: boolean }) {
  const Icon = tool.icon
  const unavailable = tool.where === 'server' && !serverOnline
  return (
    <Link to={`/tool/${tool.id}`} className={`row${unavailable ? ' disabled' : ''}`}>
      <span className="row-icon" style={{ background: `var(${tool.color})` }}>
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="row-text">
        <span className="row-title">{tool.name}</span>
        <span className="row-detail">{tool.description}</span>
      </span>
      <span className="row-accessory">
        {!tool.ready && <span className="badge">Pronto</span>}
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
