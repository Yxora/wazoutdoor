import { describe, expect, it } from 'vitest'
import type { Place } from './place'
import { DEFAULT_PREFERENCES, PROFILES } from './profile'
import type { ProtectedArea } from './protectedArea'
import { sampleRoute } from './route'
import { DEFAULT_SIGNALISATION_PREFERENCES, type Signalisation } from './signalisation'
import {
  computeScore,
  estimateDurationMinutes,
  formatDuration,
  scoreDaylight,
  scoreFire,
  scoreProtectedArea,
  scoreShelter,
  scoreSignalisations,
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

describe('scoreSignalisations', () => {
  const weatherOk = scoreWeather(1, '88', 's')

  const sig = (type: Signalisation['type'], lat: number, lng = 7): Signalisation => ({
    id: `${type}${lat}`,
    type,
    description: '',
    position: { lat, lng },
    createdAt: new Date(),
  })

  it('est ok sans signalement proche', () => {
    expect(scoreSignalisations(longLine, [sig('arbre', 48.1, 7.1)], 's').status).toBe('ok')
  })

  it('prévient pour un ou deux signalements proches', () => {
    const result = scoreSignalisations(longLine, [sig('arbre', 48.1)], 's')
    expect(result.status).toBe('warning')
    expect(result.facets?.[0].label).toBe('Arbre tombé')
  })

  it('détaille chaque signalement : type, description, distance et ancienneté', () => {
    const now = new Date('2026-10-12T10:00:00Z')
    const tree = { ...sig('arbre', 48.1), description: 'Sur le sentier, contournable par la gauche', createdAt: new Date('2026-10-10T10:00:00Z') }
    const [facet] = scoreSignalisations(longLine, [tree], 's', undefined, now).facets ?? []
    expect(facet.label).toBe('Arbre tombé')
    expect(facet.detail).toContain('contournable par la gauche')
    expect(facet.detail).toContain('signalé il y a 2 jours')
    expect(facet.detail).toMatch(/à \d+ m du tracé \(zone d’effet : 150 m\)/)
  })

  it('classe les signalements du plus proche au plus loin', () => {
    const facets = scoreSignalisations(longLine, [sig('arbre', 48.05, 7.001), sig('boue', 48.15)], 's').facets
    expect(facets?.map((f) => f.label)).toEqual(['Boue, passage glissant', 'Arbre tombé'])
  })

  it('ignore les types de signalements que l’utilisateur a ignorés', () => {
    const modes = { ...DEFAULT_SIGNALISATION_PREFERENCES, arbre: 'ignore' as const }
    expect(scoreSignalisations(longLine, [sig('arbre', 48.1)], 's', modes).status).toBe('ok')
  })

  it('passe en alerte avec un type en red flag, et le signale pour mettre le score à 0', () => {
    const modes = { ...DEFAULT_SIGNALISATION_PREFERENCES, chasse: 'veto' as const }
    const result = scoreSignalisations(longLine, [sig('chasse', 48.1)], 's', modes)
    expect(result.status).toBe('alert')
    expect(result.redFlag).toBe('Chasse en cours')
    expect(computeScore([result, weatherOk], randonneur).total).toBe(0)
  })

  it('compte la chasse dans un rayon de 3 km autour du tracé', () => {
    const near = scoreSignalisations(longLine, [sig('chasse', 48.1, 7.03)], 's')
    expect(near.status).toBe('warning')
    expect(near.facets?.[0].detail).toContain('zone d’effet : 3,0 km')
    expect(scoreSignalisations(longLine, [sig('chasse', 48.1, 7.06)], 's').status).toBe('ok')
  })

  it('garde 150 m pour les autres types', () => {
    expect(scoreSignalisations(longLine, [sig('arbre', 48.1, 7.03)], 's').status).toBe('ok')
  })

  it('ne déclenche pas le red flag si ce type est loin du tracé', () => {
    const modes = { ...DEFAULT_SIGNALISATION_PREFERENCES, chasse: 'veto' as const }
    expect(scoreSignalisations(longLine, [sig('chasse', 48.1, 7.2)], 's', modes).redFlag).toBeUndefined()
  })

  it('alerte à partir de trois signalements', () => {
    const many = [sig('arbre', 48.05), sig('boue', 48.1), sig('neige', 48.15)]
    expect(scoreSignalisations(longLine, many, 's').status).toBe('alert')
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

  it('ignore la préférence utilisateur pour l’incendie : toujours en red flag', () => {
    const fireAlert = scoreFire(
      longLine,
      [{ position: { lat: 48.1, lng: 7 }, acquiredAt: new Date(), confidence: 'high', frp: 20, satellite: 'N' }],
      's',
    )
    const result = computeScore([ok, weatherOk, fireAlert], randonneur, { ...DEFAULT_PREFERENCES, fire: 'impact' })
    expect(result.total).toBe(0)
    expect(result.vetoedBy).toBe('fire')
  })

  it('force l’incendie en red flag même si l’utilisateur le règle sur « ignorer »', () => {
    const fireAlert = scoreFire(
      longLine,
      [{ position: { lat: 48.1, lng: 7 }, acquiredAt: new Date(), confidence: 'high', frp: 20, satellite: 'N' }],
      's',
    )
    const result = computeScore([ok, weatherOk, fireAlert], randonneur, { ...DEFAULT_PREFERENCES, fire: 'ignore' })
    expect(result.total).toBe(0)
    expect(result.vetoedBy).toBe('fire')
  })

  it('ne laisse pas ignorer une zone protégée : elle pèse comme « prendre en compte »', () => {
    const protectedArea = scoreProtectedArea(longLine, [squareAround(48.1)], 's')
    const ignored = computeScore([ok, weatherOk, protectedArea], randonneur, { ...DEFAULT_PREFERENCES, protectedArea: 'ignore' })
    const counted = computeScore([ok, weatherOk, protectedArea], randonneur, { ...DEFAULT_PREFERENCES, protectedArea: 'impact' })
    expect(ignored.total).toBe(counted.total)
    expect(ignored.criteria.find((c) => c.id === 'protectedArea')?.mode).toBe('impact')
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

  describe('préférences de l’utilisateur', () => {
    const alertDaylight = scoreDaylight(at('17:30'), at('17:00'), 's')

    it('donne le même résultat par défaut que sans préférences', () => {
      expect(computeScore([ok, alertDaylight, weatherOk], randonneur, DEFAULT_PREFERENCES)).toEqual(
        computeScore([ok, alertDaylight, weatherOk], randonneur),
      )
    })

    it('exclut un critère ignoré du total et du décompte', () => {
      const result = computeScore([alertDaylight, weatherOk], randonneur, { ...DEFAULT_PREFERENCES, daylight: 'ignore' })
      expect(result.total).toBe(100)
      expect(result.totalCriteria).toBe(1)
      expect(result.criteria).toHaveLength(2)
      expect(result.criteria[0].mode).toBe('ignore')
    })

    it('ne compte pas l’alerte d’un critère ignoré dans le verdict', () => {
      const result = computeScore([alertDaylight, weatherOk], randonneur, { ...DEFAULT_PREFERENCES, daylight: 'ignore' })
      expect(result.verdict).toBe('serene')
    })

    it('met le score à 0 quand un critère éliminatoire est en alerte', () => {
      const result = computeScore([alertDaylight, weatherOk], randonneur, { ...DEFAULT_PREFERENCES, daylight: 'veto' })
      expect(result.total).toBe(0)
      expect(result.verdict).toBe('alert')
      expect(result.vetoedBy).toBe('daylight')
    })

    it('n’a pas d’effet quand le critère éliminatoire n’est pas en alerte', () => {
      const result = computeScore([ok, weatherOk], randonneur, { ...DEFAULT_PREFERENCES, daylight: 'veto' })
      expect(result.total).toBe(100)
      expect(result.vetoedBy).toBeNull()
    })

    it('ne met pas à 0 quand le critère éliminatoire est indisponible', () => {
      const unknown = unknownCriterion('daylight', 'Retour avant la nuit', 'x', 's')
      const result = computeScore([unknown, weatherOk], randonneur, { ...DEFAULT_PREFERENCES, daylight: 'veto' })
      expect(result.total).toBe(100)
      expect(result.vetoedBy).toBeNull()
    })

    it('renvoie null quand tous les critères sont ignorés', () => {
      const all = {
        daylight: 'ignore',
        weather: 'ignore',
        forecast: 'ignore',
        water: 'ignore',
        shelter: 'ignore',
        fire: 'ignore',
        protectedArea: 'ignore',
        signalisations: 'ignore',
      } as const
      const result = computeScore([ok, weatherOk], randonneur, all)
      expect(result.total).toBeNull()
      expect(result.totalCriteria).toBe(0)
    })
  })
})

describe('formatDuration', () => {
  it('formate les durées', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(120)).toBe('2 h')
    expect(formatDuration(95)).toBe('1 h 35')
  })
})
