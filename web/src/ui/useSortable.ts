import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

const LONG_PRESS_MS = 350
const MOVE_TOLERANCE = 8

interface DragState {
  pointerId: number
  index: number
  el: HTMLElement
  grabX: number // posición del dedo dentro del elemento
  grabY: number
  x: number
  y: number
  active: boolean
  timer?: number
  startX: number
  startY: number
}

/** Reordenar arrastrando (rejillas y listas), pensado para táctil:
 *  - Sobre un elemento con `data-drag-handle` el arrastre empieza al instante.
 *  - En el resto del elemento, con pulsación larga (si `longPress`), para no
 *    interferir con el scroll ni con los toques.
 *  Mientras se arrastra se bloquea el scroll de iOS y, al soltar, se ignora el click. */
export function useSortable<T>(items: T[], onReorder: (next: T[]) => void, { longPress = true } = {}) {
  const drag = useRef<DragState | null>(null)
  const suppressClick = useRef(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  // iOS: impedir el scroll mientras hay un arrastre activo
  useEffect(() => {
    const block = (e: TouchEvent) => {
      if (drag.current?.active) e.preventDefault()
    }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [])

  const place = () => {
    const d = drag.current
    if (!d?.active) return
    d.el.style.transform = ''
    const r = d.el.getBoundingClientRect()
    d.el.style.transform = `translate(${d.x - d.grabX - r.left}px, ${d.y - d.grabY - r.top}px) scale(1.04)`
  }

  // Tras reordenar, el elemento cambia de hueco: recolocarlo bajo el dedo
  useLayoutEffect(place, [items])

  const activate = () => {
    const d = drag.current
    if (!d) return
    d.active = true
    try {
      d.el.setPointerCapture(d.pointerId)
    } catch {
      /* el puntero ya no existe */
    }
    setDragIndex(d.index)
    place()
  }

  const end = () => {
    const d = drag.current
    if (!d) return
    clearTimeout(d.timer)
    if (d.active) {
      d.el.style.transform = ''
      suppressClick.current = true
      setTimeout(() => (suppressClick.current = false), 0)
    }
    drag.current = null
    setDragIndex(null)
  }

  const itemProps = (index: number) => ({
    'data-sort-index': index,
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return
      const el = e.currentTarget
      const r = el.getBoundingClientRect()
      const onHandle = !!(e.target as Element).closest('[data-drag-handle]')
      if (!onHandle && !longPress) return
      drag.current = {
        pointerId: e.pointerId, index, el,
        grabX: e.clientX - r.left, grabY: e.clientY - r.top,
        x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY,
        active: false,
      }
      if (onHandle) activate()
      else drag.current.timer = window.setTimeout(activate, LONG_PRESS_MS)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || d.pointerId !== e.pointerId) return
      d.x = e.clientX
      d.y = e.clientY
      if (!d.active) {
        // Se ha movido antes de la pulsación larga: es un scroll
        if (Math.hypot(d.x - d.startX, d.y - d.startY) > MOVE_TOLERANCE) end()
        return
      }
      place()
      const target = document
        .elementsFromPoint(d.x, d.y)
        .map((el) => (el as HTMLElement).closest<HTMLElement>('[data-sort-index]'))
        .find((el) => el && el !== d.el)
      if (!target) return
      const to = Number(target.dataset.sortIndex)
      if (Number.isNaN(to) || to === d.index) return
      const next = [...items]
      const [moved] = next.splice(d.index, 1)
      next.splice(to, 0, moved)
      d.index = to
      setDragIndex(to)
      onReorder(next)
    },
    onPointerUp: end,
    onPointerCancel: end,
    onClickCapture: (e: MouseEvent) => {
      if (suppressClick.current) {
        e.stopPropagation()
        e.preventDefault()
      }
    },
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  })

  return { itemProps, dragIndex }
}
