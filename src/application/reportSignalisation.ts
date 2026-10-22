import { createSignalisation, type NewSignalisation, type Signalisation } from '../domain/signalisation'
import { requireAccount } from './authError'
import type { AuthGateway, PhotoStore, SignalisationStore } from './ports'

export interface ReportInput extends Omit<NewSignalisation, 'photoUrl'> {
  /** Photo prise pour qualifier le signalement, en data URL JPEG */
  photo?: string
}

/**
 * Compte requis, vérifié avant l'envoi de la photo.
 * Si l'envoi de la photo échoue, rien n'est enregistré : l'utilisateur·rice peut réessayer sans doublon.
 */
export async function reportSignalisation(
  auth: Pick<AuthGateway, 'current'>,
  store: SignalisationStore,
  input: ReportInput,
  photos?: PhotoStore,
): Promise<Signalisation> {
  requireAccount(auth)
  const { photo, ...details } = input
  const signalisation = createSignalisation(details)
  if (photo && photos) signalisation.photoUrl = await photos.upload(signalisation.id, photo)
  await store.save(signalisation)
  return signalisation
}
