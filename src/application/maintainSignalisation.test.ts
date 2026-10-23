import { describe, expect, it } from 'vitest'
import type { Account } from '../domain/account'
import { addComment, confirmSignalisation, createSignalisation, reportGone, type Signalisation } from '../domain/signalisation'
import {
  checkNearbySignalisations,
  commentSignalisation,
  confirmSignalisationStillThere,
  listMyGoneVotes,
  reportSignalisationGone,
} from './maintainSignalisation'
import type { SignalisationStore } from './ports'

function fakeStore(initial: Signalisation[]): SignalisationStore & { calls: string[] } {
  const find = (id: string) => initial.find((s) => s.id === id)!
  const calls: string[] = []
  return {
    calls,
    save: async () => {},
    confirm: async (id) => {
      calls.push('confirm')
      return confirmSignalisation(find(id))
    },
    reportGone: async (id) => {
      calls.push('reportGone')
      return reportGone(find(id))
    },
    addComment: async (id, text) => {
      calls.push('addComment')
      return addComment(find(id), text)
    },
    myGoneVotes: async () => {
      calls.push('myGoneVotes')
      return [existing.id]
    },
    list: async () => initial,
  }
}

const signedIn = { current: (): Account | null => ({ id: 'u1', email: 'julie@exemple.fr' }) }
const signedOut = { current: (): Account | null => null }

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
    const result = await confirmSignalisationStillThere(signedIn, store, existing.id)
    expect(result.goneVotes).toBe(0)
  })

  it('« plus là » ajoute une voix', async () => {
    const result = await reportSignalisationGone(signedIn, fakeStore([existing]), existing.id)
    expect(result.goneVotes).toBe(1)
  })

  it('ajoute un commentaire sous les autres', async () => {
    const first = await commentSignalisation(signedIn, fakeStore([existing]), existing.id, 'Contournable à gauche')
    const second = addComment(first, 'Toujours là ce matin')
    expect(second.comments).toEqual(['Contournable à gauche', 'Toujours là ce matin'])
  })
})

describe('sans compte', () => {
  it('refuse de confirmer, voter et commenter, sans appeler le stockage', async () => {
    const store = fakeStore([existing])

    await expect(confirmSignalisationStillThere(signedOut, store, existing.id)).rejects.toMatchObject({ code: 'not_signed_in' })
    await expect(reportSignalisationGone(signedOut, store, existing.id)).rejects.toMatchObject({ code: 'not_signed_in' })
    await expect(commentSignalisation(signedOut, store, existing.id, 'Encore là')).rejects.toMatchObject({ code: 'not_signed_in' })
    expect(store.calls).toEqual([])
  })
})

describe('listMyGoneVotes', () => {
  it('renvoie les votes « Plus là » du compte', async () => {
    const store = fakeStore([existing])
    expect(await listMyGoneVotes(signedIn, store)).toEqual(new Set([existing.id]))
  })

  it('sans compte, ne demande rien au store', async () => {
    const store = fakeStore([existing])
    expect(await listMyGoneVotes(signedOut, store)).toEqual(new Set())
    expect(store.calls).toEqual([])
  })
})
