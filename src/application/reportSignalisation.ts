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
 * Si l'enregistrement échoue après la photo (quota atteint, réseau), la photo est effacée : elle ne reste pas publique seule.
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
  try {
    await store.save(signalisation)
  } catch (error) {
    // Au mieux : si l'effacement échoue aussi, l'erreur d'origine reste celle qu'on montre
    if (signalisation.photoUrl && photos) await photos.remove(signalisation.photoUrl).catch(() => {})
    throw error
  }
  return signalisation
}
