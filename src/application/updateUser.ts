import type { User } from '../domain/user'
import { requireAccount } from './authError'
import type { AuthGateway, UserStore } from './ports'

export type UserChanges = Partial<Pick<User, 'activities' | 'preferences' | 'signalisationPreferences'>>

/** Applique les changements et les enregistre (compte requis). Une activité au moins : sans elle, le panel n'aurait aucun profil à proposer. */
export function updateUser(auth: Pick<AuthGateway, 'current'>, store: UserStore, changes: UserChanges): User {
  requireAccount(auth)
  const current = store.get()
  const next: User = { ...current, ...changes }
  if (next.activities.length === 0) throw new Error('Choisissez au moins une activité.')
  store.save(next)
  return next
}
