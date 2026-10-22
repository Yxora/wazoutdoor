import type { AuthGateway } from './ports'

/** Déconnexion : l'app repasse en lecture seule, avec les critères standards */
export function signOut(auth: AuthGateway): Promise<void> {
  return auth.signOut()
}
