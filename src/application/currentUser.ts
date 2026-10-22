import { STANDARD_USER, type User } from '../domain/user'
import type { AuthGateway, UserStore } from './ports'

/** Sans compte : critères standards. Avec compte : ses préférences. */
export function currentUser(auth: Pick<AuthGateway, 'current'>, store: UserStore): User {
  return auth.current() ? store.get() : STANDARD_USER
}
