import { describe, expect, it } from 'vitest'
import { createSignalisation, type Signalisation } from '../domain/signalisation'
import { listActiveSignalisations } from './listSignalisations'
import type { SignalisationStore } from './ports'

function storeWith(signalisations: Signalisation[]): SignalisationStore {
  return { save: async () => {}, confirm: async () => Promise.reject(new Error('inutilisé')), reportGone: async () => Promise.reject(new Error('inutilisé')), addComment: async () => Promise.reject(new Error('inutilisé')), myGoneVotes: async () => [], mySignalisations: async () => [], resolve: async () => Promise.reject(new Error('inutilisé')), remove: async () => {}, list: async () => signalisations }
}

const POSITION = { lat: 48.05, lng: 7.02 }

describe('listActiveSignalisations', () => {
  it('écarte les signalements expirés', async () => {
    const recent = createSignalisation({ type: 'arbre', description: '', position: POSITION }, new Date('2026-06-20T09:00:00Z'))
    const old = createSignalisation({ type: 'chasse', description: '', position: POSITION }, new Date('2026-01-01T09:00:00Z'))
    const store = storeWith([recent, old])

    const result = await listActiveSignalisations(store, new Date('2026-06-21T09:00:00Z'))

    expect(result).toEqual([recent])
  })
})
