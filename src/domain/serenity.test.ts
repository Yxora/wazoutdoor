import { describe, expect, it } from 'vitest'
import type { Place } from './place'
import { PROFILES } from './profile'
import type { ProtectedArea } from './protectedArea'
import { sampleRoute } from './route'
import {
  computeScore,
  estimateDurationMinutes,
  formatDuration,
  scoreDaylight,
  scoreFire,
  scoreProtectedArea,
  scoreShelter,
  scoreWater,
  scoreWeather,
  unknownCriterion,
} from './serenity'

const randonneur = PROFILES.randonneur
const at = (hhmm: string) => new Date(`2026-10-11T${hhmm}:00Z`)

// environ 22 km vers le nord
const longLine = sampleRoute(
  [
    { lat: 48, lng: 7 },
    { lat: 48.2, lng: 7 },
  ],
  250,
)

const place = (kind: Place['kind'], lat: number, lng = 7): Place => ({
  id: `${kind}-${lat}`,
  name: kind,
  kind,
  category: kind === 'water' ? 'water' : 'hut',
  position: { lat, lng },
  source: 'test',
})

describe('estimateDurationMinutes', () => {
  it('additionne le temps à plat et le temps de montée', () => {
    // 10 km à 5 km/h = 2 h ; 600 m à 600 m/h = 1 h
    expect(estimateDurationMinutes(10_000, 600, randonneur)).toBe(180)
  })

  it('est plus court pour un traileur', () => {
    expect(estimateDurationMinutes(10_000, 600, PROFILES.traileur)).toBeLessThan(180)
  })
})

describe('scoreDaylight', () => {
  const sunset = at('17:00')
  it('est ok avec 2 h de marge', () => expect(scoreDaylight(at('14:30'), sunset, 's').status).toBe('ok'))
  it('prévient avec 1 h de marge', () => expect(scoreDaylight(at('15:45'), sunset, 's').status).toBe('warning'))
  it('alerte avec moins d’1 h', () => expect(scoreDaylight(at('16:30'), sunset, 's').status).toBe('alert'))
  it('donne 0 après le coucher du soleil', () => {
    const result = scoreDaylight(at('17:30'), sunset, 's')
    expect(result.score).toBe(0)
    expect(result.detail).toContain('après le coucher')
  })
})

describe('scoreWeather', () => {
  it.each([
    [1, 'ok'],
    [2, 'warning'],
    [3, 'alert'],
    [4, 'alert'],
  ])('niveau %i -> %s', (level, status) => {
    expect(scoreWeather(level, '88', 's').status).toBe(status)
  })
})

describe('scoreWater', () => {
  it('est ok quand les points d’eau sont réguliers', () => {
    const waters = [place('water', 48.05), place('water', 48.1), place('water', 48.15)]
    expect(scoreWater(longLine, waters, randonneur, 's').status).toBe('ok')
  })

  it('alerte quand un long tronçon n’a pas d’eau', () => {
    const waters = [place('water', 48.002)]
    expect(scoreWater(longLine, waters, randonneur, 's').status).toBe('alert')
  })

  it('ignore les points d’eau trop éloignés du tracé', () => {
    const farAway = [place('water', 48.05, 7.1)]
    expect(scoreWater(longLine, farAway, randonneur, 's').status).toBe('alert')
  })

  it('accepte l’absence d’eau sur un parcours court', () => {
    const short = sampleRoute(
      [
        { lat: 48, lng: 7 },
        { lat: 48.02, lng: 7 },
      ],
      250,
    )
    expect(scoreWater(short, [], randonneur, 's').status).toBe('ok')
  })
})

describe('scoreShelter', () => {
  it('prévient quand aucun abri n’est connu', () => {
    expect(scoreShelter(longLine, [], randonneur, 's').status).toBe('warning')
  })

  it('est ok quand un abri est proche de tout le tracé', () => {
    const shelters = [
      place('shelter', 48.02),
      place('shelter', 48.06),
      place('shelter', 48.1),
      place('shelter', 48.14),
      place('shelter', 48.18),
    ]
    expect(scoreShelter(longLine, shelters, randonneur, 's').status).toBe('ok')
  })

  it('alerte quand un abri n’est qu’au départ', () => {
    expect(scoreShelter(longLine, [place('shelter', 48)], randonneur, 's').status).toBe('alert')
  })
})

describe('scoreFire', () => {
  it('est ok sans détection à proximité du tracé', () => {
    const result = scoreFire(longLine, [], 's')
    expect(result.status).toBe('ok')
    expect(result.score).toBe(100)
  })

  it('ignore une détection trop éloignée du tracé', () => {
    const far = [{ position: { lat: 48.1, lng: 7.5 }, acquiredAt: new Date(), confidence: 'high' as const, frp: 1, satellite: 'N' }]
    expect(scoreFire(longLine, far, 's').status).toBe('ok')
  })

  it('alerte et met le score à 0 quand un feu est détecté près du tracé', () => {
    const near = [{ position: { lat: 48.1, lng: 7 }, acquiredAt: new Date(), confidence: 'high' as const, frp: 20, satellite: 'N' }]
    const result = scoreFire(longLine, near, 's')
    expect(result.status).toBe('alert')
    expect(result.score).toBe(0)
    expect(result.detail).toContain('1 détection')
  })
})

function squareAround(centerLat: number): ProtectedArea {
  return {
    name: 'Réserve test',
    category: 'Réserve naturelle nationale',
    url: 'https://inpn.mnhn.fr/test',
    polygons: [
      [
        [
          { lat: centerLat - 0.01, lng: 6.99 },
          { lat: centerLat - 0.01, lng: 7.01 },
          { lat: centerLat + 0.01, lng: 7.01 },
          { lat: centerLat + 0.01, lng: 6.99 },
          { lat: centerLat - 0.01, lng: 6.99 },
        ],
      ],
    ],
  }
}

describe('scoreProtectedArea', () => {
  it('est ok quand le tracé ne traverse aucune zone protégée', () => {
    const result = scoreProtectedArea(longLine, [squareAround(49)], 's')
    expect(result.status).toBe('ok')
    expect(result.score).toBe(100)
  })

  it('avertit (sans alerte) quand le tracé traverse une zone protégée', () => {
    const result = scoreProtectedArea(longLine, [squareAround(48.1)], 's')
    expect(result.status).toBe('warning')
    expect(result.score).toBe(60)
    expect(result.facets?.[0].detail).toContain('Réserve test')
  })
})

describe('computeScore', () => {
  const ok = scoreDaylight(at('14:00'), at('17:00'), 's')
  const weatherOk = scoreWeather(1, '88', 's')

  it('fait la moyenne pondérée des critères disponibles', () => {
    const result = computeScore([ok, weatherOk], randonneur)
    expect(result.total).toBe(100)
    expect(result.verdict).toBe('serene')
  })

  it('force le score à 0 quand le critère incendie est en alerte, même si tout le reste est parfait', () => {
    const fireAlert = scoreFire(
      longLine,
      [{ position: { lat: 48.1, lng: 7 }, acquiredAt: new Date(), confidence: 'high', frp: 20, satellite: 'N' }],
      's',
    )
    const result = computeScore([ok, weatherOk, fireAlert], randonneur)
    expect(result.total).toBe(0)
    expect(result.verdict).toBe('alert')
  })

  it('pondère la zone protégée comme un critère normal, sans forcer le score (contrairement à l’incendie)', () => {
    const protectedArea = scoreProtectedArea(longLine, [squareAround(48.1)], 's')
    const result = computeScore([ok, weatherOk, protectedArea], randonneur)
    // poids randonneur : daylight 3, weather 3, protectedArea 2 -> (100*3 + 100*3 + 60*2) / 8 = 90
    expect(result.total).toBe(90)
    expect(result.verdict).not.toBe('alert')
  })

  it('ignore les critères indisponibles sans les compter comme bons', () => {
    const unknown = unknownCriterion('water', 'Points d’eau', 'hors ligne', 's')
    const result = computeScore([ok, weatherOk, unknown], randonneur)
    expect(result.availableCriteria).toBe(2)
    expect(result.totalCriteria).toBe(3)
  })

  it('renvoie null quand rien n’est disponible', () => {
    const result = computeScore([unknownCriterion('water', 'Points d’eau', 'x', 's')], randonneur)
    expect(result.total).toBeNull()
    expect(result.verdict).toBeNull()
  })

  it('n’affiche pas « serein » quand une alerte est présente', () => {
    const alert = scoreDaylight(at('17:30'), at('17:00'), 's')
    const result = computeScore([alert, weatherOk, weatherOk, weatherOk], randonneur)
    expect(result.verdict).not.toBe('serene')
  })
})

describe('formatDuration', () => {
  it('formate les durées', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(95)).toBe('1 h 35')
  })
})
