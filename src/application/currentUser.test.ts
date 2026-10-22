import { describe, expect, it } from 'vitest'
import type { Account } from '../domain/account'
import { DEFAULT_PREFERENCES } from '../domain/profile'
import { DEMO_USER, STANDARD_USER } from '../domain/user'
import { currentUser } from './currentUser'
import type { UserStore } from './ports'

const store: UserStore = { get: () => DEMO_USER, save: () => {} }

describe('currentUser', () => {
  it('sans compte : critères standards et les trois profils', () => {
    const user = currentUser({ current: () => null }, store)
    expect(user).toBe(STANDARD_USER)
    expect(user.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(user.activities).toEqual(['randonneur', 'traileur', 'vttiste'])
  })

  it('avec compte : les préférences enregistrées', () => {
    const account: Account = { id: 'u1', email: 'julie@exemple.fr' }
    expect(currentUser({ current: () => account }, store)).toBe(DEMO_USER)
  })
})
