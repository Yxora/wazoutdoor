import { describe, expect, it } from 'vitest'
import type { Place } from '../domain/place'
import { PROFILES } from '../domain/profile'
import type { Route } from '../domain/route'
import { evaluateRoute, type EvaluationDeps } from './evaluateRoute'

const route: Route = {
  name: 'Test',
  points: [
    { lat: 48, lng: 7 },
    { lat: 48.05, lng: 7 },
  ],
}

const start = new Date('2026-10-11T08:00:00Z')

const water: Place = {
  id: 'w',
  name: 'Source',
  kind: 'water',
  category: 'water',
  position: { lat: 48.025, lng: 7 },
  source: 't',
}
const shelter: Place = {
  id: 's',
  name: 'Abri',
  kind: 'shelter',
  category: 'hut',
  position: { lat: 48.025, lng: 7 },
  source: 't',
}

function deps(overrides: Partial<EvaluationDeps> = {}): EvaluationDeps {
  return {
    elevation: { source: 'alti', elevations: async (points) => points.map((_, i) => 1000 + i * 10) },
    daylight: { source: 'soleil', sunset: async () => new Date('2026-10-11T17:00:00Z') },
    weather: {
      source: 'vigilance',
      highestLevel: async () => ({ level: 1, department: '88', updatedAt: new Date('2026-10-11T04:00:00Z') }),
    },
    forecast: {
      source: 'prévisions',
      hourly: async (_at, from) => [
        {
          time: from,
          apparentTemperature: 12,
          precipitationMm: 0,
          precipitationProbability: 5,
          windGustKmh: 20,
          weatherCode: 1,
        },
      ],
    },
    places: { source: 'refuges', around: async () => [water, shelter] },
    ...overrides,
  }
}

describe('evaluateRoute', () => {
  it('évalue les quatre critères et résume le parcours', async () => {
    const result = await evaluateRoute(deps(), { route, profile: PROFILES.randonneur, start })
    expect(result.score.criteria.map((c) => c.id)).toEqual(['daylight', 'weather', 'forecast', 'water', 'shelter'])
    expect(result.score.availableCriteria).toBe(5)
    expect(result.summary.distanceKm).toBeCloseTo(5.6, 1)
    expect(result.summary.ascentM).toBeGreaterThan(0)
    expect(result.places).toHaveLength(2)
  })

  it('utilise l’altitude du GPX sans appeler le service', async () => {
    const withEle: Route = {
      name: 'avec altitude',
      points: [
        { lat: 48, lng: 7, ele: 1000 },
        { lat: 48.05, lng: 7, ele: 1300 },
      ],
    }
    const failing = deps({
      elevation: {
        source: 'alti',
        elevations: async () => {
          throw new Error('ne devrait pas être appelé')
        },
      },
    })
    const result = await evaluateRoute(failing, { route: withEle, profile: PROFILES.randonneur, start })
    expect(result.summary.ascentM).toBe(300)
  })

  it('continue sans dénivelé quand l’altimétrie échoue', async () => {
    const broken = deps({
      elevation: {
        source: 'alti',
        elevations: async () => {
          throw new Error('hors ligne')
        },
      },
    })
    const result = await evaluateRoute(broken, { route, profile: PROFILES.randonneur, start })
    expect(result.summary.ascentM).toBeNull()
    expect(result.score.availableCriteria).toBe(5)
  })

  it('marque un critère indisponible quand sa source échoue, sans bloquer les autres', async () => {
    const broken = deps({
      weather: {
        source: 'vigilance',
        highestLevel: async () => {
          throw new Error('clé refusée')
        },
      },
    })
    const result = await evaluateRoute(broken, { route, profile: PROFILES.randonneur, start })
    const weather = result.score.criteria.find((c) => c.id === 'weather')
    expect(weather?.status).toBe('unknown')
    expect(weather?.detail).toContain('clé refusée')
    expect(result.score.availableCriteria).toBe(4)
  })

  it('transmet à la météo la fenêtre de la sortie et l’altitude moyenne', async () => {
    const seen: { from: Date; to: Date; altitude: number | null }[] = []
    const spy = deps({
      forecast: {
        source: 'prévisions',
        hourly: async (_at, from, to, altitude) => {
          seen.push({ from, to, altitude })
          return []
        },
      },
    })
    await evaluateRoute(spy, { route, profile: PROFILES.randonneur, start })
    expect(seen).toHaveLength(1)
    expect(seen[0].from).toEqual(start)
    expect(seen[0].to.getTime()).toBeGreaterThan(start.getTime())
    expect(seen[0].altitude).toBeGreaterThan(1000)
  })

  it('met la météo prévue en alerte en cas d’orage, sans bloquer les autres critères', async () => {
    const stormy = deps({
      forecast: {
        source: 'prévisions',
        hourly: async (_at, from) => [
          {
            time: from,
            apparentTemperature: 15,
            precipitationMm: 5,
            precipitationProbability: 90,
            windGustKmh: 40,
            weatherCode: 95,
          },
        ],
      },
    })
    const result = await evaluateRoute(stormy, { route, profile: PROFILES.randonneur, start })
    const forecast = result.score.criteria.find((c) => c.id === 'forecast')
    expect(forecast?.status).toBe('alert')
    expect(result.score.verdict).not.toBe('serene')
  })

  it('marque eau et abris indisponibles quand le fournisseur de lieux échoue', async () => {
    const broken = deps({
      places: {
        source: 'refuges',
        around: async () => {
          throw new Error('504')
        },
      },
    })
    const result = await evaluateRoute(broken, { route, profile: PROFILES.randonneur, start })
    expect(result.score.criteria.filter((c) => c.status === 'unknown').map((c) => c.id)).toEqual(['water', 'shelter'])
  })
})
