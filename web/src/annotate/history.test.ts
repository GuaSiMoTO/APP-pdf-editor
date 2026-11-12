import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, popSnapshot, pushSnapshot } from './history'

describe('historial de deshacer', () => {
  it('apila y deshace en orden inverso', () => {
    let h = pushSnapshot<string[]>([], ['a'])
    h = pushSnapshot(h, ['a', 'b'])
    const first = popSnapshot(h)!
    expect(first.restored).toEqual(['a', 'b'])
    expect(popSnapshot(first.history)!.restored).toEqual(['a'])
  })

  it('no hay nada que deshacer en un historial vacío', () => {
    expect(popSnapshot([])).toBeNull()
  })

  it(`conserva como mucho ${HISTORY_LIMIT} pasos (los más recientes)`, () => {
    let h: number[] = []
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) h = pushSnapshot(h, i)
    expect(h).toHaveLength(HISTORY_LIMIT)
    expect(h[0]).toBe(10)
    expect(h[h.length - 1]).toBe(HISTORY_LIMIT + 9)
  })

  it('no modifica el historial original', () => {
    const h = [1, 2]
    pushSnapshot(h, 3)
    popSnapshot(h)
    expect(h).toEqual([1, 2])
  })
})
