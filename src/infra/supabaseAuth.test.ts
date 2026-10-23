import { describe, expect, it } from 'vitest'
import { AuthError } from '../application/authError'
import { callbackUrl, isSignInReturn, SupabaseAuth } from './supabaseAuth'

const USER = { id: 'u1', aud: 'authenticated', email: 'julie@exemple.fr', app_metadata: {}, user_metadata: {}, created_at: '2026-10-22T12:00:00Z' }
const REDIRECT = 'https://app.test/?auth=callback'

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

function session(overrides: Record<string, unknown> = {}) {
  const expiresIn = (overrides.expires_in as number | undefined) ?? 3600
  return {
    access_token: 'access',
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: USER,
    ...overrides,
  }
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** fetch simulé : enregistre les appels ; chaque réponse est choisie d'après l'adresse */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; body: Record<string, unknown> }[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : {} })
    const route = Object.keys(routes).find((path) => url.includes(path))
    if (!route) throw new TypeError('Failed to fetch')
    return routes[route]()
  }
  return { calls, fetch: fetch as typeof globalThis.fetch }
}

function create(routes: Record<string, () => Response>, storage = fakeStorage()) {
  const { calls, fetch } = fakeFetch(routes)
  return { calls, storage, auth: SupabaseAuth.create({ url: 'https://projet.supabase.co/', anonKey: 'anon', redirectTo: REDIRECT, storage, fetch }) }
}

async function sha256base64url(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('callbackUrl et isSignInReturn', () => {
  it('ajoute le marqueur à l’adresse de l’app, sans garder l’ancienne requête', () => {
    expect(callbackUrl('https://yxora.github.io/wazoutdoor/?pos=48,7#x')).toBe('https://yxora.github.io/wazoutdoor/?auth=callback')
  })

  it('ne prend pas un retour Strava pour un retour de lien', () => {
    expect(isSignInReturn(new URL('https://app.test/?code=abc&state=xyz'))).toBe(false)
    expect(isSignInReturn(new URL('https://app.test/?auth=callback&code=abc'))).toBe(true)
  })
})

describe('SupabaseAuth : lien magique PKCE', () => {
  it('demande le lien avec l’adresse de retour et un challenge S256', async () => {
    const { auth, calls } = create({ '/otp': () => respond(200, {}) })
    await (await auth).sendSignInLink('julie@exemple.fr')

    const otp = calls.find((c) => c.url.includes('/otp'))!
    expect(otp.url).toContain('https://projet.supabase.co/auth/v1/otp')
    expect(new URL(otp.url).searchParams.get('redirect_to')).toBe(REDIRECT)
    expect(otp.body).toMatchObject({ email: 'julie@exemple.fr', create_user: true, code_challenge_method: 's256' })
    expect(otp.body.code_challenge).toEqual(expect.any(String))
  })

  it('au retour, échange le code avec le verifier qui correspond au challenge envoyé', async () => {
    const { auth: pending, calls } = create({ '/otp': () => respond(200, {}), 'grant_type=pkce': () => respond(200, session()) })
    const auth = await pending
    const changes: unknown[] = []
    auth.onChange((account) => changes.push(account))

    await auth.sendSignInLink('julie@exemple.fr')
    const account = await auth.finishSignIn(new URL('https://app.test/?auth=callback&code=abc'))

    const otp = calls.find((c) => c.url.includes('/otp'))!
    const token = calls.find((c) => c.url.includes('grant_type=pkce'))!
    expect(token.body.auth_code).toBe('abc')
    expect(await sha256base64url(token.body.code_verifier as string)).toBe(otp.body.code_challenge)
    expect(account).toEqual({ id: 'u1', email: 'julie@exemple.fr' })
    expect(auth.current()).toEqual(account)
    expect(changes).toEqual([account])
  })

  it('ignore une URL qui n’est pas un retour de lien, sans appel réseau', async () => {
    const { auth, calls } = create({})
    const before = calls.length
    expect(await (await auth).finishSignIn(new URL('https://app.test/?code=strava&state=x'))).toBeNull()
    expect(calls).toHaveLength(before)
  })

  it('sans verifier (lien ouvert dans un autre navigateur) : missing_verifier, sans échange', async () => {
    const { auth, calls } = create({ 'grant_type=pkce': () => respond(200, session()) })
    await expect((await auth).finishSignIn(new URL('https://app.test/?auth=callback&code=abc'))).rejects.toMatchObject({ code: 'missing_verifier' })
    expect(calls.some((c) => c.url.includes('grant_type=pkce'))).toBe(false)
  })

  it('lien périmé : Supabase revient avec une erreur, link_expired', async () => {
    const { auth } = create({})
    const url = new URL('https://app.test/?auth=callback&error=access_denied&error_code=otp_expired')
    await expect((await auth).finishSignIn(url)).rejects.toMatchObject({ code: 'link_expired' })
  })

  it('traduit le quota d’emails en rate_limited', async () => {
    const { auth } = create({ '/otp': () => respond(429, { error_code: 'over_email_send_rate_limit', msg: 'rate limit' }) })
    await expect((await auth).sendSignInLink('julie@exemple.fr')).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('traduit une panne réseau en network', async () => {
    const { auth } = create({})
    const attempt = (await auth).sendSignInLink('julie@exemple.fr')
    await expect(attempt).rejects.toBeInstanceOf(AuthError)
    await expect(attempt).rejects.toMatchObject({ code: 'network' })
  })
})

describe('SupabaseAuth : code à 6 chiffres', () => {
  it('connecte avec le code et garde la session pour le prochain lancement', async () => {
    const { auth: pending, calls, storage } = create({ '/verify': () => respond(200, session()) })
    const auth = await pending

    expect(await auth.verifyCode('julie@exemple.fr', '123456')).toEqual({ id: 'u1', email: 'julie@exemple.fr' })
    expect(calls.find((c) => c.url.includes('/verify'))!.body).toMatchObject({ type: 'email', email: 'julie@exemple.fr', token: '123456' })

    const relaunched = await create({}, storage).auth
    expect(relaunched.current()).toEqual({ id: 'u1', email: 'julie@exemple.fr' })
  })

  it('code faux ou expiré : wrong_code', async () => {
    const { auth } = create({ '/verify': () => respond(403, { error_code: 'otp_expired', msg: 'Token has expired or is invalid' }) })
    await expect((await auth).verifyCode('julie@exemple.fr', '000000')).rejects.toMatchObject({ code: 'wrong_code' })
  })

  it('refuse une session de compte anonyme', async () => {
    const anonymous = { ...USER, email: '', is_anonymous: true }
    const { auth: pending } = create({ '/verify': () => respond(200, session({ user: anonymous })), '/logout': () => new Response(null, { status: 204 }) })
    const auth = await pending
    await expect(auth.verifyCode('julie@exemple.fr', '123456')).rejects.toThrow('réponse de connexion inattendue')
    expect(auth.current()).toBeNull()
    expect(await auth.accessToken()).toBeNull()
  })
})

describe('SupabaseAuth : session et jeton', () => {
  it('sans session : pas de compte ni de jeton', async () => {
    const auth = await create({}).auth
    expect(auth.current()).toBeNull()
    expect(await auth.accessToken()).toBeNull()
  })

  it('renvoie le jeton du compte connecté', async () => {
    const auth = await create({ '/verify': () => respond(200, session()) }).auth
    await auth.verifyCode('julie@exemple.fr', '123456')
    expect(await auth.accessToken()).toBe('access')
  })

  it('rafraîchit un jeton qui expire', async () => {
    const { auth: pending, calls } = create({
      '/verify': () => respond(200, session({ expires_in: 5 })),
      'grant_type=refresh_token': () => respond(200, session({ access_token: 'access-2', refresh_token: 'refresh-2' })),
    })
    const auth = await pending
    await auth.verifyCode('julie@exemple.fr', '123456')

    expect(await auth.accessToken()).toBe('access-2')
    expect(calls.find((c) => c.url.includes('grant_type=refresh_token'))!.body).toEqual({ refresh_token: 'refresh' })
  })

  it('la déconnexion révoque la session de cet appareil', async () => {
    const { auth: pending, calls } = create({ '/verify': () => respond(200, session()), '/logout': () => new Response(null, { status: 204 }) })
    const auth = await pending
    const changes: unknown[] = []
    auth.onChange((account) => changes.push(account))
    await auth.verifyCode('julie@exemple.fr', '123456')
    await auth.signOut()

    expect(calls.find((c) => c.url.includes('/logout'))!.url).toContain('scope=local')
    expect(auth.current()).toBeNull()
    expect(changes.at(-1)).toBeNull()
  })

  it('la déconnexion efface la session même sans réseau', async () => {
    const { auth: pending, storage } = create({ '/verify': () => respond(200, session()) })
    const auth = await pending
    await auth.verifyCode('julie@exemple.fr', '123456')
    await auth.signOut()

    expect(auth.current()).toBeNull()
    expect((await create({}, storage).auth).current()).toBeNull()
  })
})
