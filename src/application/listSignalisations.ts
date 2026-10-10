import { isExpired, type Signalisation } from '../domain/signalisation'
import type { SignalisationStore } from './ports'

export async function listActiveSignalisations(store: SignalisationStore, now = new Date()): Promise<Signalisation[]> {
  const all = await store.list()
  return all.filter((signalisation) => !isExpired(signalisation, now))
}
