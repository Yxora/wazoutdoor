import { describe, expect, it } from 'vitest'
import { ascentMeters, boundingBox, distanceMeters, routeLengthMeters, sampleRoute } from './route'

describe('distanceMeters', () => {
  it('vaut environ 111 km pour un degré de latitude', () => {
    const d = distanceMeters({ lat: 48, lng: 7 }, { lat: 49, lng: 7 })
    expect(d).toBeGreaterThan(111_000)
    expect(d).toBeLessThan(111_400)
  })
})

describe('sampleRoute', () => {
  const line = [
    { lat: 48, lng: 7 },
    { lat: 48.01, lng: 7 },
  ]

  it('inclut le départ, des points réguliers et l’arrivée', () => {
    const samples = sampleRoute(line, 250)
    expect(samples[0].atMeters).toBe(0)
    expect(samples[1].atMeters).toBe(250)
    const last = samples[samples.length - 1]
    expect(last.atMeters).toBeCloseTo(routeLengthMeters(line), 0)
    expect(last.lat).toBe(48.01)
  })

  it('renvoie un tableau vide sans point', () => {
    expect(sampleRoute([], 100)).toEqual([])
  })
})

describe('ascentMeters', () => {
  it('cumule uniquement les montées', () => {
    expect(ascentMeters([1000, 1100, 1050, 1200])).toBe(100 + 150)
  })

  it('ignore le bruit sous le seuil', () => {
    expect(ascentMeters([1000, 1001, 1000, 1002, 1000])).toBe(0)
  })
})

describe('boundingBox', () => {
  it('englobe les points avec une marge', () => {
    const box = boundingBox(
      [
        { lat: 48, lng: 7 },
        { lat: 48.1, lng: 7.2 },
      ],
      0.01,
    )
    expect(box.west).toBeCloseTo(6.99)
    expect(box.north).toBeCloseTo(48.11)
  })
})
