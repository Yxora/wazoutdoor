import type { User } from '../domain/user'
import type { UserStore } from './ports'

export type UserChanges = Partial<Pick<User, 'activities' | 'preferences' | 'signalisationPreferences'>>

/** Applique les changements et les enregistre. Une activité au moins : sans elle, le panel n'aurait aucun profil à proposer. */
export function updateUser(store: UserStore, changes: UserChanges): User {
  const current = store.get()
  const next: User = { ...current, ...changes }
  if (next.activities.length === 0) throw new Error('Choisissez au moins une activité.')
  store.save(next)
  return next
}
