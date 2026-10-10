import { describe, expect, it } from 'vitest'
import { DEMO_USER } from '../domain/user'
import { LocalUserStore } from './localUserStore'

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  } as unknown as Storage
}

describe('LocalUserStore', () => {
  it('renvoie l’utilisateur de démo quand rien n’est enregistré', () => {
    expect(new LocalUserStore(fakeStorage()).get()).toEqual(DEMO_USER)
  })

  it('relit ce qui a été enregistré', () => {
    const store = new LocalUserStore(fakeStorage())
    const user = { ...DEMO_USER, activities: ['vttiste' as const], preferences: { ...DEMO_USER.preferences, water: 'ignore' as const }, signalisationPreferences: { ...DEMO_USER.signalisationPreferences, chasse: 'veto' as const } }
    store.save(user)
    expect(store.get()).toEqual(user)
  })

  it('retombe sur la démo si le JSON est invalide', () => {
    expect(new LocalUserStore(fakeStorage({ 'wazoutdoor:user:v2': '{pas du json' })).get()).toEqual(DEMO_USER)
  })

  it('écarte les activités et modes inconnus', () => {
    const raw = JSON.stringify({ activities: ['escalade', 'trail', 'traileur'], preferences: { water: 'bizarre', shelter: 'veto' }, signalisationPreferences: { arbre: 'ignore', chasse: 'nimporte' } })
    const user = new LocalUserStore(fakeStorage({ 'wazoutdoor:user:v2': raw })).get()
    expect(user.activities).toEqual(['traileur'])
    expect(user.preferences.water).toBe('impact')
    expect(user.preferences.shelter).toBe('veto')
    expect(user.signalisationPreferences.arbre).toBe('ignore')
    expect(user.signalisationPreferences.chasse).toBe('impact')
  })

  it('ne plante pas quand le stockage refuse l’écriture', () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error('quota') } } as unknown as Storage
    expect(() => new LocalUserStore(storage).save(DEMO_USER)).not.toThrow()
  })
})
