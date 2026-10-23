import { requireAccount } from './authError'
import type { AuthGateway, UserStore } from './ports'

/**
 * Supprime le compte (droit à l'effacement) puis déconnecte. Les préférences quittent l'appareil d'abord :
 * après la suppression, le store ne saurait plus quel compte nettoyer. Les signalements restent, sans lien avec le compte.
 */
export async function deleteAccount(auth: AuthGateway, store: Pick<UserStore, 'clear'>): Promise<void> {
  requireAccount(auth)
  store.clear()
  await auth.deleteAccount()
}
