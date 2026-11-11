import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface NavBarProps {
  title?: string
  /** Enlace "atrás" estilo iOS: chevron + texto. */
  back?: { to: string; label: string } | { onClick: () => void; label: string }
  trailing?: ReactNode
  transparent?: boolean
}

export function NavBar({ title, back, trailing, transparent }: NavBarProps) {
  return (
    <header className={`navbar${transparent ? ' transparent' : ''}`}>
      <div className="navbar-inner">
        <div className="navbar-side">
          {back &&
            ('to' in back ? (
              <Link to={back.to} className="bar-button">
                <ChevronLeft size={26} strokeWidth={2.2} style={{ marginLeft: -6 }} />
                {back.label}
              </Link>
            ) : (
              <button type="button" className="bar-button" onClick={back.onClick}>
                <ChevronLeft size={26} strokeWidth={2.2} style={{ marginLeft: -6 }} />
                {back.label}
              </button>
            ))}
        </div>
        <div className="navbar-title">{title}</div>
        <div className="navbar-side end">{trailing}</div>
      </div>
    </header>
  )
}
