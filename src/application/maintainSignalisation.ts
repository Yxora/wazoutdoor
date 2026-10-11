import { findNearbySignalisations, type NearbySignalisations, type Signalisation } from '../domain/signalisation'
import type { Coordinates } from '../domain/coordinates'
import type { SignalisationType } from '../domain/signalisation'
import type { SignalisationStore } from './ports'

/** Ce qui existe déjà autour de la position, avant d'enregistrer un nouveau signalement */
export async function checkNearbySignalisations(
  store: SignalisationStore,
  position: Coordinates,
  type: SignalisationType,
  now = new Date(),
): Promise<NearbySignalisations> {
  return findNearbySignalisations(position, type, await store.list(), now)
}

/** « Toujours là » : confirme un signalement vu par quelqu'un d'autre */
export function confirmSignalisationStillThere(store: SignalisationStore, id: string): Promise<Signalisation> {
  return store.confirm(id)
}

/** « Plus là » : à deux voix, le signalement est résolu et disparaît de la carte et du score */
export function reportSignalisationGone(store: SignalisationStore, id: string): Promise<Signalisation> {
  return store.reportGone(id)
}

/** Ajoute un commentaire à un signalement existant */
export function commentSignalisation(store: SignalisationStore, id: string, text: string): Promise<Signalisation> {
  return store.addComment(id, text)
}
