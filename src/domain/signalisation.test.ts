import { describe, expect, it } from 'vitest'
import {
  addComment,
  confirmSignalisation,
  createSignalisation,
  findNearbySignalisations,
  freshness,
  isExpired,
  isGonePending,
  isLive,
  reportGone,
  signalisationStatus,
  SIGNALISATION_TYPE_LABEL,
  SIGNALISATION_TYPES,
} from './signalisation'

const POSITION = { lat: 48.05, lng: 7.02 }

describe('createSignalisation', () => {
  it('génère un identifiant et reprend les champs saisis, à l’instant', () => {
    const now = new Date('2026-06-01T09:00:00Z')
    const signalisation = createSignalisation({ type: 'arbre', description: 'Travers le chemin', position: POSITION }, now)

    expect(signalisation.id).toBeTruthy()
    expect(signalisation.type).toBe('arbre')
    expect(signalisation.description).toBe('Travers le chemin')
    expect(signalisation.position).toEqual(POSITION)
    expect(signalisation.createdAt).toEqual(now)
  })

  it('retire les espaces inutiles et tronque une description trop longue', () => {
    const signalisation = createSignalisation({
      type: 'autre',
      description: `  ${'x'.repeat(300)}  `,
      position: POSITION,
    })
    expect(signalisation.description).toHaveLength(280)
  })

  it('a un libellé pour chaque type', () => {
    for (const type of SIGNALISATION_TYPES) {
      expect(SIGNALISATION_TYPE_LABEL[type]).toBeTruthy()
    }
  })
})

describe('cycle de vie', () => {
  const make = (type: Parameters<typeof createSignalisation>[0]['type'], createdAt: string) =>
    createSignalisation({ type, description: '', position: POSITION }, new Date(createdAt))
  const at = (iso: string) => new Date(iso)

  it('la durée de validité dépend du type : 12 h pour la chasse, 21 jours pour un arbre', () => {
    const hunt = make('chasse', '2026-10-11T00:00:00Z')
    const tree = make('arbre', '2026-10-11T00:00:00Z')
    const later = at('2026-10-12T00:00:00Z')
    expect(isExpired(hunt, later)).toBe(true)
    expect(isExpired(tree, later)).toBe(false)
  })

  it('passe de actif à « à confirmer » à la moitié de la durée, puis expiré', () => {
    const hunt = make('chasse', '2026-10-11T00:00:00Z')
    expect(signalisationStatus(hunt, at('2026-10-11T05:00:00Z'))).toBe('active')
    expect(signalisationStatus(hunt, at('2026-10-11T07:00:00Z'))).toBe('to_confirm')
    expect(signalisationStatus(hunt, at('2026-10-11T13:00:00Z'))).toBe('expired')
  })

  it('est résolu à deux « plus là », et plus affiché', () => {
    const tree = make('arbre', '2026-10-11T00:00:00Z')
    const now = at('2026-10-11T01:00:00Z')
    const once = reportGone(tree)
    expect(signalisationStatus(once, now)).toBe('active')
    const twice = reportGone(once)
    expect(signalisationStatus(twice, now)).toBe('resolved')
    expect(isLive(twice, now)).toBe(false)
  })

  it('« toujours là » repart de maintenant et remet les « plus là » à zéro', () => {
    const old = reportGone(make('arbre', '2026-10-01T00:00:00Z'))
    const now = at('2026-10-20T00:00:00Z')
    const confirmed = confirmSignalisation(old, now)
    expect(confirmed.createdAt).toBe(now)
    expect(confirmed.goneVotes).toBe(0)
    expect(signalisationStatus(confirmed, now)).toBe('active')
  })

  it('le poids vaut 1 jusqu’à la moitié de la durée, puis décroît sans descendre sous 0,4', () => {
    const tree = make('arbre', '2026-10-01T00:00:00Z')
    expect(freshness(tree, at('2026-10-05T00:00:00Z'))).toBe(1)
    const mid = freshness(tree, at('2026-10-16T00:00:00Z'))
    expect(mid).toBeGreaterThan(0.4)
    expect(mid).toBeLessThan(1)
    expect(freshness(tree, at('2026-10-22T00:00:00Z'))).toBe(0.4)
  })
})

describe('findNearbySignalisations', () => {
  const here = { lat: 48.0, lng: 7.0 }
  // ~0,001° de latitude ≈ 111 m
  const at = (dLat: number) => ({ lat: 48.0 + dLat, lng: 7.0 })
  const now = new Date('2026-10-11T10:00:00Z')
  const make = (type: Parameters<typeof createSignalisation>[0]['type'], dLat: number, date = now) =>
    createSignalisation({ type, description: '', position: at(dLat) }, date)

  it('trouve le signalement de même type dans la zone d’effet', () => {
    const near = make('arbre', 0.001)
    const result = findNearbySignalisations(here, 'arbre', [near, make('arbre', 0.01)], now)
    expect(result.sameType?.signalisation).toBe(near)
    expect(result.otherTypes).toEqual([])
  })

  it('range à part les signalements d’un autre type', () => {
    const other = make('boue', 0.001)
    const result = findNearbySignalisations(here, 'arbre', [other], now)
    expect(result.sameType).toBeUndefined()
    expect(result.otherTypes.map((o) => o.signalisation)).toEqual([other])
  })

  it('utilise 3 km pour la chasse entre deux signalements de chasse', () => {
    const result = findNearbySignalisations(here, 'chasse', [make('chasse', 0.02)], now)
    expect(result.sameType).toBeDefined()
  })

  it('une battue lointaine ne bloque pas un autre type hors de sa propre zone', () => {
    const result = findNearbySignalisations(here, 'arbre', [make('chasse', 0.02)], now)
    expect(result.otherTypes).toEqual([])
  })

  it('ignore les signalements expirés', () => {
    const old = make('arbre', 0.001, new Date('2026-01-01T00:00:00Z'))
    expect(findNearbySignalisations(here, 'arbre', [old], now).sameType).toBeUndefined()
  })
})

describe('addComment', () => {
  const base = createSignalisation({ type: 'arbre', description: '', position: { lat: 48, lng: 7 } })

  it('ajoute le commentaire sous les autres, sans espaces autour', () => {
    const once = addComment(base, '  Contournable à gauche ')
    expect(addComment(once, 'Toujours là').comments).toEqual(['Contournable à gauche', 'Toujours là'])
  })

  it('ignore un commentaire vide', () => {
    expect(addComment(base, '   ')).toBe(base)
  })

  it('coupe à 140 caractères et plafonne à 10 commentaires', () => {
    expect(addComment(base, 'x'.repeat(200)).comments?.[0]).toHaveLength(140)
    let s = base
    for (let i = 0; i < 12; i++) s = addComment(s, `c${i}`)
    expect(s.comments).toHaveLength(10)
  })
})

describe('isGonePending', () => {
  const base = createSignalisation({ type: 'arbre', description: '', position: { lat: 48, lng: 7 } })

  it('est vrai après un « plus là », faux avant et après le second', () => {
    expect(isGonePending(base)).toBe(false)
    expect(isGonePending(reportGone(base))).toBe(true)
    expect(isGonePending(reportGone(reportGone(base)))).toBe(false)
  })

  it('« toujours là » le fait repartir à zéro', () => {
    expect(isGonePending(confirmSignalisation(reportGone(base)))).toBe(false)
  })
})
