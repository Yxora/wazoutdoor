import { describe, expect, it } from 'vitest'
import type { Signalisation } from '../domain/signalisation'
import { reportSignalisation } from './reportSignalisation'
import type { SignalisationStore } from './ports'

function fakeStore(): SignalisationStore & { saved: Signalisation[] } {
  const saved: Signalisation[] = []
  return {
    saved,
    save: async (signalisation) => {
      saved.push(signalisation)
    },
    list: async () => saved,
  }
}

describe('reportSignalisation', () => {
  it('crée le signalement et le transmet au port de stockage', async () => {
    const store = fakeStore()
    const position = { lat: 48.05, lng: 7.02 }

    const result = await reportSignalisation(store, { type: 'arbre', description: 'Travers le chemin', position })

    expect(result.type).toBe('arbre')
    expect(result.position).toEqual(position)
    expect(store.saved).toEqual([result])
  })

  it('envoie la photo puis joint son adresse au signalement', async () => {
    const store = fakeStore()
    const photos = { upload: async (id: string) => `https://photos/${id}.jpg` }

    const result = await reportSignalisation(
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
    }

    await expect(
      reportSignalisation(store, { type: 'arbre', description: '', position: { lat: 48, lng: 7 }, photo: 'data:x' }, photos),
    ).rejects.toThrow()
    expect(store.saved).toEqual([])
  })
})
