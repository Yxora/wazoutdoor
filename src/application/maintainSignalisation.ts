import { findNearbySignalisations, type NearbySignalisations, type Signalisation } from '../domain/signalisation'
import type { Coordinates } from '../domain/coordinates'
import type { SignalisationType } from '../domain/signalisation'
import { requireAccount } from './authError'
import type { AuthGateway, SignalisationStore } from './ports'

/** Ce qui existe déjà autour de la position, avant d'enregistrer un nouveau signalement */
export async function checkNearbySignalisations(
  store: SignalisationStore,
  position: Coordinates,
  type: SignalisationType,
  now = new Date(),
): Promise<NearbySignalisations> {
  return findNearbySignalisations(position, type, await store.list(), now)
}

/** « Toujours là » : confirme un signalement vu par quelqu'un d'autre. Compte requis, comme pour voter et commenter */
export async function confirmSignalisationStillThere(auth: Pick<AuthGateway, 'current'>, store: SignalisationStore, id: string): Promise<Signalisation> {
  requireAccount(auth)
  return store.confirm(id)
}

/** « Plus là » : à deux voix, le signalement est résolu et disparaît de la carte et du score */
export async function reportSignalisationGone(auth: Pick<AuthGateway, 'current'>, store: SignalisationStore, id: string): Promise<Signalisation> {
  requireAccount(auth)
  return store.reportGone(id)
}

/** Signalements où le compte a déjà voté « Plus là » : leur bouton est grisé. Vide sans compte */
export async function listMyGoneVotes(auth: Pick<AuthGateway, 'current'>, store: SignalisationStore): Promise<Set<string>> {
  if (!auth.current()) return new Set()
  return new Set(await store.myGoneVotes())
}

/** Ajoute un commentaire à un signalement existant */
export async function commentSignalisation(auth: Pick<AuthGateway, 'current'>, store: SignalisationStore, id: string, text: string): Promise<Signalisation> {
  requireAccount(auth)
  return store.addComment(id, text)
}
