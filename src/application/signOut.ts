import type { AuthGateway, UserStore } from './ports'

/** Déconnexion : l'app repasse en lecture seule, avec les critères standards. Les préférences du compte quittent l'appareil. */
export function signOut(auth: AuthGateway, store: Pick<UserStore, 'clear'>): Promise<void> {
  store.clear()
  return auth.signOut()
}
