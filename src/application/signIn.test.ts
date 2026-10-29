import { describe, expect, it } from 'vitest'
import type { Account } from '../domain/account'
import { AuthError } from './authError'
import type { AuthGateway } from './ports'
import { finishSignIn, sendSignInLink, verifyCode } from './signIn'
import { deleteAccount } from './deleteAccount'
import { signOut } from './signOut'

const JULIE: Account = { id: 'u1', email: 'julie@exemple.fr' }

/** Faux gateway : garde le compte connecté et la trace des appels */
function fakeAuth(): AuthGateway & { calls: string[]; account: Account | null } {
  const auth = {
    calls: [] as string[],
    account: null as Account | null,
    current: () => auth.account,
    sendSignInLink: async (email: string) => {
      auth.calls.push(`link:${email}`)
    },
    finishSignIn: async (url: URL) => {
      auth.calls.push(`finish:${url.search}`)
      auth.account = url.searchParams.has('auth') ? JULIE : null
      return auth.account
    },
    verifyCode: async (email: string, code: string) => {
      auth.calls.push(`code:${email}:${code}`)
      auth.account = JULIE
      return JULIE
    },
    accessToken: async () => null,
    signInWithGoogle: async () => { auth.calls.push('google') },
    signOut: async () => {
      auth.calls.push('signOut')
      auth.account = null
    },
    deleteAccount: async () => {
      auth.calls.push('deleteAccount')
      auth.account = null
    },
    onChange: () => {},
  }
  return auth
}

describe('sendSignInLink', () => {
  it('envoie l’email nettoyé (espaces, majuscules)', async () => {
    const auth = fakeAuth()
    await sendSignInLink(auth, '  Julie@Exemple.FR ')
    expect(auth.calls).toEqual(['link:julie@exemple.fr'])
  })

  it.each(['', 'julie', 'julie@', 'julie@exemple', 'ju lie@exemple.fr'])('refuse « %s » sans appel réseau', async (email) => {
    const auth = fakeAuth()
    const attempt = sendSignInLink(auth, email)
    await expect(attempt).rejects.toBeInstanceOf(AuthError)
    await expect(attempt).rejects.toMatchObject({ code: 'invalid_email' })
    expect(auth.calls).toEqual([])
  })
})

describe('verifyCode', () => {
  it('connecte avec un code à 6 chiffres, espaces tolérés', async () => {
    const auth = fakeAuth()
    const account = await verifyCode(auth, 'julie@exemple.fr', ' 123 456 ')
    expect(account).toEqual(JULIE)
    expect(auth.calls).toEqual(['code:julie@exemple.fr:123456'])
  })

  it.each(['', '12345', '1234567', 'abcdef'])('refuse le code « %s » sans appel réseau', async (code) => {
    const auth = fakeAuth()
    await expect(verifyCode(auth, 'julie@exemple.fr', code)).rejects.toMatchObject({ code: 'wrong_code' })
    expect(auth.calls).toEqual([])
  })

  it('refuse un email invalide sans appel réseau', async () => {
    const auth = fakeAuth()
    await expect(verifyCode(auth, 'julie', '123456')).rejects.toMatchObject({ code: 'invalid_email' })
    expect(auth.calls).toEqual([])
  })
})

describe('finishSignIn et signOut', () => {
  it('renvoie le compte au retour du lien, null sinon', async () => {
    const auth = fakeAuth()
    expect(await finishSignIn(auth, new URL('https://app.test/?code=strava&state=x'))).toBeNull()
    expect(await finishSignIn(auth, new URL('https://app.test/?auth=callback&code=abc'))).toEqual(JULIE)
  })

  it('la déconnexion efface le compte courant et ses préférences sur l’appareil', async () => {
    const auth = fakeAuth()
    await verifyCode(auth, 'julie@exemple.fr', '123456')
    let clearedFor: string | null | undefined
    await signOut(auth, { clear: () => (clearedFor = auth.current()?.id ?? null) })
    expect(auth.current()).toBeNull()
    // Effacé avant la déconnexion : le store sait encore quel compte nettoyer
    expect(clearedFor).toBe(JULIE.id)
  })
})

describe('deleteAccount', () => {
  it('efface les préférences de l’appareil, puis supprime le compte', async () => {
    const auth = fakeAuth()
    await verifyCode(auth, 'julie@exemple.fr', '123456')
    const order: string[] = []
    await deleteAccount(auth, { clear: () => void order.push(`clear:${auth.current()?.id}`) })
    expect(order).toEqual(['clear:u1'])
    expect(auth.calls.at(-1)).toBe('deleteAccount')
    expect(auth.current()).toBeNull()
  })

  it('sans compte, ne fait rien', async () => {
    const auth = fakeAuth()
    await expect(deleteAccount(auth, { clear: () => {} })).rejects.toMatchObject({ code: 'not_signed_in' })
    expect(auth.calls).toEqual([])
  })
})
