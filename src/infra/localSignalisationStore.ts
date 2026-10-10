import type { SignalisationStore } from '../application/ports'
import type { Signalisation } from '../domain/signalisation'

const STORAGE_KEY = 'wazoutdoor:signalisations'

type StoredSignalisation = Omit<Signalisation, 'createdAt'> & { createdAt: string }

/** Stocke les signalements dans le navigateur. En attendant un vrai backend communautaire (Supabase). */
export class LocalSignalisationStore implements SignalisationStore {
  async save(signalisation: Signalisation): Promise<void> {
    const all = await this.list()
    all.push(signalisation)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }

  async list(): Promise<Signalisation[]> {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    try {
      const stored = JSON.parse(raw) as StoredSignalisation[]
      return stored.map((s) => ({ ...s, createdAt: new Date(s.createdAt) }))
    } catch {
      return []
    }
  }
}
