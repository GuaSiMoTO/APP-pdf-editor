import { describe, expect, it } from 'vitest'
import { defaultQuad, distance, orderQuad } from './geometry'

describe('orderQuad', () => {
  it('ordena cuatro puntos como TL, TR, BR, BL sea cual sea el orden de entrada', () => {
    const tl = { x: 310, y: 120 }, tr = { x: 950, y: 180 }, br = { x: 880, y: 820 }, bl = { x: 200, y: 760 }
    expect(orderQuad([br, tl, bl, tr])).toEqual([tl, tr, br, bl])
    expect(orderQuad([bl, br, tr, tl])).toEqual([tl, tr, br, bl])
  })
})

describe('defaultQuad', () => {
  it('deja un margen proporcional', () => {
    expect(defaultQuad(100, 200, 0.1)).toEqual([{ x: 10, y: 20 }, { x: 90, y: 20 }, { x: 90, y: 180 }, { x: 10, y: 180 }])
  })
})

describe('distance', () => {
  it('es la distancia euclídea', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
})
