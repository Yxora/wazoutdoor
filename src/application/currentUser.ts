import { STANDARD_USER, type User } from '../domain/user'
import type { AuthGateway, UserStore } from './ports'

/** Sans compte : critères standards. Avec compte : ses préférences, sous son email tant qu'il n'y a pas de pseudo. */
export function currentUser(auth: Pick<AuthGateway, 'current'>, store: UserStore): User {
  const account = auth.current()
  return account ? { ...store.get(), name: account.email } : STANDARD_USER
}

/** Comme `currentUser`, après avoir relu les préférences enregistrées du compte (autre appareil) */
export async function loadCurrentUser(auth: Pick<AuthGateway, 'current'>, store: UserStore): Promise<User> {
  if (!auth.current()) return STANDARD_USER
  await store.load()
  return currentUser(auth, store)
}
