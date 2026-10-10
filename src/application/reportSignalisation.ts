import { createSignalisation, type NewSignalisation, type Signalisation } from '../domain/signalisation'
import type { PhotoStore, SignalisationStore } from './ports'

export interface ReportInput extends Omit<NewSignalisation, 'photoUrl'> {
  /** Photo prise pour qualifier le signalement, en data URL JPEG */
  photo?: string
}

/** Si l'envoi de la photo échoue, rien n'est enregistré : l'utilisateur·rice peut réessayer sans doublon */
export async function reportSignalisation(
  store: SignalisationStore,
  input: ReportInput,
  photos?: PhotoStore,
): Promise<Signalisation> {
  const { photo, ...details } = input
  const signalisation = createSignalisation(details)
  if (photo && photos) signalisation.photoUrl = await photos.upload(signalisation.id, photo)
  await store.save(signalisation)
  return signalisation
}
