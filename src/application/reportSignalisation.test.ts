import { describe, expect, it } from 'vitest'
import type { Account } from '../domain/account'
import type { Signalisation } from '../domain/signalisation'
import { AuthError } from './authError'
import { reportSignalisation } from './reportSignalisation'
import type { SignalisationStore } from './ports'

function fakeStore(): SignalisationStore & { saved: Signalisation[] } {
  const saved: Signalisation[] = []
  return {
    saved,
    save: async (signalisation) => {
      saved.push(signalisation)
    },
    confirm: async () => Promise.reject(new Error('inutilisé')), reportGone: async () => Promise.reject(new Error('inutilisé')), addComment: async () => Promise.reject(new Error('inutilisé')), myGoneVotes: async () => [], mySignalisations: async () => [], remove: async () => {},
    list: async () => saved,
  }
}

const signedIn = { current: (): Account | null => ({ id: 'u1', email: 'julie@exemple.fr' }) }
const signedOut = { current: (): Account | null => null }

describe('reportSignalisation', () => {
  it('crée le signalement et le transmet au port de stockage', async () => {
    const store = fakeStore()
    const position = { lat: 48.05, lng: 7.02 }

    const result = await reportSignalisation(signedIn, store, { type: 'arbre', description: 'Travers le chemin', position })

    expect(result.type).toBe('arbre')
    expect(result.position).toEqual(position)
    expect(store.saved).toEqual([result])
  })

  it('envoie la photo puis joint son adresse au signalement', async () => {
    const store = fakeStore()
    const photos = { upload: async (id: string) => `https://photos/${id}.jpg`, remove: async () => {} }

    const result = await reportSignalisation(
      signedIn,
      store,
      { type: 'arbre', description: '', position: { lat: 48, lng: 7 }, photo: 'data:image/jpeg;base64,AAA' },
      photos,
    )

    expect(result.photoUrl).toBe(`https://photos/${result.id}.jpg`)
    expect(store.saved).toEqual([result])
  })

  it('n’enregistre rien si l’envoi de la photo échoue', async () => {
    const store = fakeStore()
    const photos = {
      upload: async () => {
        throw new Error('réseau')
      },
      remove: async () => {},
    }

    await expect(
      reportSignalisation(signedIn, store, { type: 'arbre', description: '', position: { lat: 48, lng: 7 }, photo: 'data:x' }, photos),
    ).rejects.toThrow()
    expect(store.saved).toEqual([])
  })

  it('efface la photo si l’enregistrement échoue ensuite (quota atteint)', async () => {
    const store = fakeStore()
    store.save = async () => {
      throw new Error('Vous avez beaucoup participé cette dernière heure, réessayez plus tard.')
    }
    const removed: string[] = []
    const photos = { upload: async (id: string) => `https://photos/${id}.jpg`, remove: async (url: string) => void removed.push(url) }

    await expect(
      reportSignalisation(signedIn, store, { type: 'arbre', description: '', position: { lat: 48, lng: 7 }, photo: 'data:x' }, photos),
    ).rejects.toThrow('réessayez plus tard')
    expect(removed).toHaveLength(1)
  })

  it('refuse sans compte, avant même d’envoyer la photo', async () => {
    const store = fakeStore()
    const uploads: string[] = []
    const photos = {
      upload: async (id: string) => {
        uploads.push(id)
        return `https://photos/${id}.jpg`
      },
      remove: async () => {},
    }

    const attempt = reportSignalisation(signedOut, store, { type: 'arbre', description: '', position: { lat: 48, lng: 7 }, photo: 'data:x' }, photos)

    await expect(attempt).rejects.toBeInstanceOf(AuthError)
    await expect(attempt).rejects.toMatchObject({ code: 'not_signed_in' })
    expect(uploads).toEqual([])
    expect(store.saved).toEqual([])
  })
})
