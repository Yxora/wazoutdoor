import { describe, expect, it } from 'vitest'
import { checkDatabase } from './checkDatabase'

describe('checkDatabase', () => {
  it('renvoie le résultat du port quand tout va bien', async () => {
    const result = await checkDatabase({ check: async () => ({ ok: true, detail: 'HTTP 200' }) })
    expect(result).toEqual({ ok: true, detail: 'HTTP 200' })
  })

  it('renvoie le résultat du port quand la base répond en erreur', async () => {
    const result = await checkDatabase({ check: async () => ({ ok: false, detail: 'HTTP 401' }) })
    expect(result.ok).toBe(false)
  })

  it("transforme une exception en résultat KO", async () => {
    const result = await checkDatabase({
      check: async () => {
        throw new Error('réseau coupé')
      },
    })
    expect(result).toEqual({ ok: false, detail: 'réseau coupé' })
  })
})
