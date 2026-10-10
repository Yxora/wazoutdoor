import { describe, expect, it } from 'vitest'
import { locateUser } from './locateUser'

describe('locateUser', () => {
  it('renvoie la position quand elle est accordée', async () => {
    const result = await locateUser({ locate: async () => ({ ok: true, position: { lat: 48.1, lng: 7.2 } }) })
    expect(result).toEqual({ ok: true, position: { lat: 48.1, lng: 7.2 } })
  })

  it("renvoie le refus de l'utilisateur", async () => {
    const result = await locateUser({ locate: async () => ({ ok: false, reason: 'denied' }) })
    expect(result).toEqual({ ok: false, reason: 'denied' })
  })

  it('transforme une exception en position indisponible', async () => {
    const result = await locateUser({
      locate: async () => {
        throw new Error('boom')
      },
    })
    expect(result).toEqual({ ok: false, reason: 'unavailable' })
  })
})
