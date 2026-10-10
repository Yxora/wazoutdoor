import { describe, expect, it } from 'vitest'
import { createSignalisation, isCritical, isExpired, SIGNALISATION_TYPE_LABEL, SIGNALISATION_TYPES } from './signalisation'

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

describe('isCritical', () => {
  it('signale un feu de forêt comme critique', () => {
    expect(isCritical('incendie')).toBe(true)
  })

  it("ne signale pas les autres types comme critiques", () => {
    expect(isCritical('dechets')).toBe(false)
    expect(isCritical('arbre')).toBe(false)
  })
})

describe('isExpired', () => {
  it("n'est pas expiré avant 30 jours", () => {
    const createdAt = new Date('2026-06-01T09:00:00Z')
    const signalisation = createSignalisation({ type: 'chasse', description: '', position: POSITION }, createdAt)
    const now = new Date('2026-06-20T09:00:00Z')
    expect(isExpired(signalisation, now)).toBe(false)
  })

  it('est expiré après 30 jours', () => {
    const createdAt = new Date('2026-06-01T09:00:00Z')
    const signalisation = createSignalisation({ type: 'chasse', description: '', position: POSITION }, createdAt)
    const now = new Date('2026-07-10T09:00:00Z')
    expect(isExpired(signalisation, now)).toBe(true)
  })
})
