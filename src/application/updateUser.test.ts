import { describe, expect, it } from 'vitest'
import { DEMO_USER, type User } from '../domain/user'
import type { UserStore } from './ports'
import { updateUser } from './updateUser'

function memoryStore(initial: User = DEMO_USER): UserStore & { saved: User | null } {
  const store = {
    saved: null as User | null,
    get: () => store.saved ?? initial,
    save: (user: User) => {
      store.saved = user
    },
  }
  return store
}

describe('updateUser', () => {
  it('enregistre les nouvelles activités', () => {
    const store = memoryStore()
    const user = updateUser(store, { activities: ['vttiste'] })
    expect(user.activities).toEqual(['vttiste'])
    expect(store.saved?.activities).toEqual(['vttiste'])
  })

  it('enregistre les préférences sans toucher aux activités', () => {
    const store = memoryStore()
    const user = updateUser(store, { preferences: { ...DEMO_USER.preferences, water: 'ignore' } })
    expect(user.preferences.water).toBe('ignore')
    expect(user.activities).toEqual(DEMO_USER.activities)
  })

  it('refuse une liste d’activités vide et n’enregistre rien', () => {
    const store = memoryStore()
    expect(() => updateUser(store, { activities: [] })).toThrow('au moins une activité')
    expect(store.saved).toBeNull()
  })
})
