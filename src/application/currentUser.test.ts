import { describe, expect, it } from 'vitest'
import type { Account } from '../domain/account'
import { DEFAULT_PREFERENCES } from '../domain/profile'
import { DEMO_USER, STANDARD_USER } from '../domain/user'
import { currentUser, loadCurrentUser } from './currentUser'
import type { UserStore } from './ports'

const store: UserStore = { get: () => DEMO_USER, load: async () => DEMO_USER, save: () => {}, clear: () => {} }

describe('currentUser', () => {
  it('sans compte : critères standards et les trois profils', () => {
    const user = currentUser({ current: () => null }, store)
    expect(user).toBe(STANDARD_USER)
    expect(user.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(user.activities).toEqual(['randonneur', 'traileur', 'vttiste'])
  })

  it('avec compte : les préférences enregistrées, sous l’email du compte', () => {
    const account: Account = { id: 'u1', email: 'julie@exemple.fr' }
    expect(currentUser({ current: () => account }, store)).toEqual({ ...DEMO_USER, name: 'julie@exemple.fr' })
  })
})

describe('loadCurrentUser', () => {
  it('avec compte : relit les préférences enregistrées avant de les renvoyer', async () => {
    let saved = DEMO_USER
    const remote = { ...DEMO_USER, activities: ['vttiste' as const] }
    const syncing: UserStore = { ...store, get: () => saved, load: async () => (saved = remote) }
    const account: Account = { id: 'u1', email: 'julie@exemple.fr' }
    expect(await loadCurrentUser({ current: () => account }, syncing)).toEqual({ ...remote, name: 'julie@exemple.fr' })
  })

  it('sans compte : critères standards, sans rien relire', async () => {
    let loaded = false
    const watching: UserStore = { ...store, load: async () => ((loaded = true), DEMO_USER) }
    expect(await loadCurrentUser({ current: () => null }, watching)).toBe(STANDARD_USER)
    expect(loaded).toBe(false)
  })
})
