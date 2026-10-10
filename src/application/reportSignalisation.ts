import { createSignalisation, type NewSignalisation, type Signalisation } from '../domain/signalisation'
import type { SignalisationStore } from './ports'

export async function reportSignalisation(store: SignalisationStore, input: NewSignalisation): Promise<Signalisation> {
  const signalisation = createSignalisation(input)
  await store.save(signalisation)
  return signalisation
}
