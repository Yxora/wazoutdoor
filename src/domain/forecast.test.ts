import { describe, expect, it } from 'vitest'
import { scoreForecast, type HourlyForecast } from './forecast'

const hour = (overrides: Partial<HourlyForecast> = {}): HourlyForecast => ({
  time: new Date('2026-10-11T09:00:00Z'),
  apparentTemperature: 12,
  precipitationMm: 0,
  precipitationProbability: 5,
  windGustKmh: 20,
  weatherCode: 1,
  ...overrides,
})

const facet = (hours: HourlyForecast[], label: string) =>
  scoreForecast(hours, 'src', 1200).facets?.find((f) => f.label === label)

describe('scoreForecast', () => {
  it('est favorable par temps calme', () => {
    const result = scoreForecast([hour(), hour()], 'src', 1200)
    expect(result.status).toBe('ok')
    expect(result.score).toBe(100)
    expect(result.facets?.map((f) => f.label)).toEqual(['Pluie', 'Température', 'Vent', 'Orage'])
  })

  it('indique l’altitude utilisée', () => {
    expect(scoreForecast([hour()], 'src', 1234).detail).toContain('1234 m')
    expect(scoreForecast([hour()], 'src', null).detail).toContain('point de départ')
  })

  it('est indisponible sans prévision', () => {
    const result = scoreForecast([], 'src', null)
    expect(result.status).toBe('unknown')
    expect(result.score).toBeNull()
  })

  describe('pluie', () => {
    it('prévient à partir de 2 mm cumulés', () => {
      expect(facet([hour({ precipitationMm: 1.5 }), hour({ precipitationMm: 1 })], 'Pluie')?.status).toBe('warning')
    })
    it('prévient quand la probabilité est forte même sans cumul', () => {
      expect(facet([hour({ precipitationProbability: 70 })], 'Pluie')?.status).toBe('warning')
    })
    it('alerte à partir de 8 mm', () => {
      expect(facet([hour({ precipitationMm: 9 })], 'Pluie')?.status).toBe('alert')
    })
    it('fonctionne sans probabilité', () => {
      const f = facet([hour({ precipitationProbability: null })], 'Pluie')
      expect(f?.status).toBe('ok')
      expect(f?.detail).not.toContain('probabilité')
    })
  })

  describe('température', () => {
    it('prévient en cas de froid', () => {
      const f = facet([hour({ apparentTemperature: 0 })], 'Froid')
      expect(f?.status).toBe('warning')
      expect(f?.detail).toContain('verglas')
    })
    it('alerte en cas de grand froid', () => {
      expect(facet([hour({ apparentTemperature: -8 })], 'Froid')?.status).toBe('alert')
    })
    it('prévient en cas de chaleur', () => {
      expect(facet([hour({ apparentTemperature: 30 })], 'Chaleur')?.status).toBe('warning')
    })
    it('alerte en cas de canicule', () => {
      const f = facet([hour({ apparentTemperature: 36 })], 'Chaleur')
      expect(f?.status).toBe('alert')
      expect(f?.detail).toContain('canicule')
    })
    it('affiche l’amplitude du ressenti', () => {
      const f = facet([hour({ apparentTemperature: 10 }), hour({ apparentTemperature: 18 })], 'Température')
      expect(f?.detail).toBe('Ressenti de 10 °C à 18 °C')
    })
  })

  describe('vent', () => {
    it.each([
      [59, 'ok'],
      [60, 'warning'],
      [90, 'alert'],
    ])('rafales à %i km/h -> %s', (gust, status) => {
      expect(facet([hour({ windGustKmh: gust })], 'Vent')?.status).toBe(status)
    })
  })

  describe('orage', () => {
    it.each([95, 96, 99])('code météo %i -> alerte', (code) => {
      expect(facet([hour({ weatherCode: code })], 'Orage')?.status).toBe('alert')
    })
    it('ne confond pas pluie forte et orage', () => {
      expect(facet([hour({ weatherCode: 65 })], 'Orage')?.status).toBe('ok')
    })
  })

  it('prend le pire élément pour le statut et le score', () => {
    const result = scoreForecast([hour({ weatherCode: 95, windGustKmh: 65 })], 'src', null)
    expect(result.status).toBe('alert')
    expect(result.score).toBe(20)
  })
})
