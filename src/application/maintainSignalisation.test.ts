import { describe, expect, it } from 'vitest'
import { addComment, confirmSignalisation, createSignalisation, reportGone, type Signalisation } from '../domain/signalisation'
import {
  checkNearbySignalisations,
  commentSignalisation,
  confirmSignalisationStillThere,
  reportSignalisationGone,
} from './maintainSignalisation'
import type { SignalisationStore } from './ports'

function fakeStore(initial: Signalisation[]): SignalisationStore {
  const find = (id: string) => initial.find((s) => s.id === id)!
  return {
    save: async () => {},
    confirm: async (id) => confirmSignalisation(find(id)),
    reportGone: async (id) => reportGone(find(id)),
    addComment: async (id, text) => addComment(find(id), text),
    list: async () => initial,
  }
}

const existing = createSignalisation({ type: 'arbre', description: 'Travers', position: { lat: 48, lng: 7 } })

describe('checkNearbySignalisations', () => {
  it('signale le signalement de même type proche', async () => {
    const result = await checkNearbySignalisations(fakeStore([existing]), { lat: 48.0003, lng: 7 }, 'arbre')
    expect(result.sameType?.signalisation).toBe(existing)
  })
})

describe('cycle de vie via le port', () => {
  it('confirme : les « plus là » repartent à zéro', async () => {
    const store = fakeStore([reportGone(existing)])
    const result = await confirmSignalisationStillThere(store, existing.id)
    expect(result.goneVotes).toBe(0)
  })

  it('« plus là » ajoute une voix', async () => {
    const result = await reportSignalisationGone(fakeStore([existing]), existing.id)
    expect(result.goneVotes).toBe(1)
  })

  it('ajoute un commentaire sous les autres', async () => {
    const first = await commentSignalisation(fakeStore([existing]), existing.id, 'Contournable à gauche')
    const second = addComment(first, 'Toujours là ce matin')
    expect(second.comments).toEqual(['Contournable à gauche', 'Toujours là ce matin'])
  })
})
