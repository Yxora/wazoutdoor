import { describe, expect, it } from 'vitest'
import type { Account } from '../domain/account'
import { addComment, confirmSignalisation, createSignalisation, markResolved, reportGone, type Signalisation } from '../domain/signalisation'
import {
  checkNearbySignalisations,
  commentSignalisation,
  confirmSignalisationStillThere,
  deleteOwnSignalisation,
  listMySignalisations,
  resolveOwnSignalisation,
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
    mySignalisations: async () => {
      calls.push('mySignalisations')
      return [existing.id]
    },
    resolve: async (id) => {
      calls.push('resolve')
      return markResolved(find(id))
    },
    remove: async () => {
      calls.push('remove')
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

describe('retrait par l’auteur·rice', () => {
  it('liste ses signalements, vide sans compte', async () => {
    expect(await listMySignalisations(signedIn, fakeStore([existing]))).toEqual(new Set([existing.id]))
    const store = fakeStore([existing])
    expect(await listMySignalisations(signedOut, store)).toEqual(new Set())
    expect(store.calls).toEqual([])
  })

  it('marque son signalement résolu', async () => {
    const resolved = await resolveOwnSignalisation(signedIn, fakeStore([existing]), existing.id)
    expect(resolved.resolvedAt).toBeInstanceOf(Date)
  })

  it('supprime la photo avant le signalement', async () => {
    const order: string[] = []
    const store = fakeStore([existing])
    const photos = { upload: async () => '', remove: async (url: string) => void order.push(`photo ${url}`) }
    store.remove = async () => void order.push('signalement')
    await deleteOwnSignalisation(signedIn, store, photos, { ...existing, photoUrl: 'https://photos/a.jpg' })
    expect(order).toEqual(['photo https://photos/a.jpg', 'signalement'])
  })

  it('photo non effacée : le signalement reste', async () => {
    const store = fakeStore([existing])
    const photos = { upload: async () => '', remove: async () => Promise.reject(new Error('HTTP 500')) }
    await expect(deleteOwnSignalisation(signedIn, store, photos, { ...existing, photoUrl: 'https://photos/a.jpg' })).rejects.toThrow('HTTP 500')
    expect(store.calls).not.toContain('remove')
  })

  it('sans compte, rien n’est retiré', async () => {
    const store = fakeStore([existing])
    await expect(resolveOwnSignalisation(signedOut, store, existing.id)).rejects.toMatchObject({ code: 'not_signed_in' })
    await expect(deleteOwnSignalisation(signedOut, store, { upload: async () => '', remove: async () => {} }, existing)).rejects.toMatchObject({ code: 'not_signed_in' })
    expect(store.calls).toEqual([])
  })
})
