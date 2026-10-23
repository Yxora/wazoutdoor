import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEMO_USER, STANDARD_USER } from '../domain/user'
import { SupabaseUserStore } from './supabaseUserStore'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage & { data: Map<string, string> }
}

const signedIn = { current: () => ({ id: 'u1', email: 'julie@exemple.fr' }), accessToken: async () => 'jeton-julie' }
const signedOut = { current: () => null, accessToken: async () => null }
const URL_BASE = 'https://example.supabase.co'
const julie = { ...DEMO_USER, activities: ['vttiste' as const], preferences: { ...DEMO_USER.preferences, water: 'ignore' as const } }
// L'identifiant et le nom viennent des critères standards : l'app affiche l'email du compte (`currentUser`)
const julieSettings = { activities: julie.activities, preferences: julie.preferences, signalisationPreferences: julie.signalisationPreferences }

function stubFetch(respond: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return respond(url, init)
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('SupabaseUserStore', () => {
  it('sans compte : critères standards, sans appel', async () => {
    const calls = stubFetch(() => new Response('[]'))
    const store = new SupabaseUserStore(URL_BASE, 'anon-key', signedOut, fakeStorage())
    expect(store.get()).toBe(STANDARD_USER)
    expect(await store.load()).toBe(STANDARD_USER)
    expect(calls).toEqual([])
  })

  it('relit la ligne du compte avec son jeton et la garde pour le prochain lancement', async () => {
    const calls = stubFetch(
      () => new Response(JSON.stringify([{ activities: ['vttiste'], preferences: { water: 'ignore' }, signalisation_preferences: {} }])),
    )
    const storage = fakeStorage()
    const store = new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, storage)
    const user = await store.load()

    expect(calls[0].url).toBe(`${URL_BASE}/rest/v1/user_preferences?select=activities,preferences,signalisation_preferences&user_id=eq.u1`)
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer jeton-julie' })
    expect(user.activities).toEqual(['vttiste'])
    expect(user.preferences.water).toBe('ignore')
    expect(storage.data.has('wazoutdoor:user:u1')).toBe(true)
    expect(store.get()).toEqual(user)
  })

  it('table vide : nouveau compte, critères standards', async () => {
    stubFetch(() => new Response('[]'))
    const store = new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, fakeStorage())
    expect(await store.load()).toEqual(STANDARD_USER)
  })

  it('jsonb invalide : modes inconnus remis par défaut', async () => {
    stubFetch(
      () => new Response(JSON.stringify([{ activities: ['escalade', 'traileur'], preferences: { water: 'bizarre' }, signalisation_preferences: 'pas un objet' }])),
    )
    const user = await new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, fakeStorage()).load()
    expect(user.activities).toEqual(['traileur'])
    expect(user.preferences).toEqual(STANDARD_USER.preferences)
    expect(user.signalisationPreferences).toEqual(STANDARD_USER.signalisationPreferences)
  })

  it('enregistre la copie locale tout de suite, puis la base (upsert)', async () => {
    const calls = stubFetch(() => new Response(null, { status: 201 }))
    const store = new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, fakeStorage())
    store.save(julie)
    expect(store.get()).toMatchObject(julieSettings)
    await store.whenSynced()

    expect(calls[0].url).toBe(`${URL_BASE}/rest/v1/user_preferences?on_conflict=user_id`)
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer jeton-julie', Prefer: 'resolution=merge-duplicates,return=minimal' })
    expect(JSON.parse(calls[0].init?.body as string)).toMatchObject({
      user_id: 'u1',
      activities: ['vttiste'],
      preferences: julie.preferences,
      signalisation_preferences: julie.signalisationPreferences,
    })
  })

  it('échec réseau à l’écriture : la copie locale est gardée', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, fakeStorage())
    store.save(julie)
    await store.whenSynced()
    expect(store.get()).toMatchObject(julieSettings)
  })

  it('rien en base mais une copie locale (écriture pas encore arrivée) : garde la copie', async () => {
    stubFetch(() => new Response('[]'))
    const storage = fakeStorage({ 'wazoutdoor:user:u1': JSON.stringify(julie) })
    expect((await new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, storage).load()).activities).toEqual(['vttiste'])
  })

  it('chaque compte a sa copie, effacée à la déconnexion', () => {
    const storage = fakeStorage({ 'wazoutdoor:user:u1': JSON.stringify(julie), 'wazoutdoor:user:u2': JSON.stringify(julie) })
    const store = new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, storage)
    store.clear()
    expect(storage.data.has('wazoutdoor:user:u1')).toBe(false)
    expect(storage.data.has('wazoutdoor:user:u2')).toBe(true)
  })

  it('jeton refusé à la lecture : demande de se connecter', async () => {
    stubFetch(() => new Response(null, { status: 401 }))
    await expect(new SupabaseUserStore(URL_BASE, 'anon-key', signedIn, fakeStorage()).load()).rejects.toMatchObject({ code: 'not_signed_in' })
  })
})
