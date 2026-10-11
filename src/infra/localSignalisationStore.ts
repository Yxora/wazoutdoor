import type { SignalisationStore } from '../application/ports'
import { addComment, confirmSignalisation, reportGone, type Signalisation } from '../domain/signalisation'

const STORAGE_KEY = 'wazoutdoor:signalisations'

type StoredSignalisation = Omit<Signalisation, 'createdAt'> & { createdAt: string }

/** Stocke les signalements dans le navigateur. En attendant un vrai backend communautaire (Supabase). */
export class LocalSignalisationStore implements SignalisationStore {
  async save(signalisation: Signalisation): Promise<void> {
    const all = await this.list()
    all.push(signalisation)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }

  async confirm(id: string): Promise<Signalisation> {
    return this.change(id, (s) => confirmSignalisation(s))
  }

  async reportGone(id: string): Promise<Signalisation> {
    return this.change(id, reportGone)
  }

  async addComment(id: string, text: string): Promise<Signalisation> {
    return this.change(id, (s) => addComment(s, text))
  }

  private async change(id: string, apply: (s: Signalisation) => Signalisation): Promise<Signalisation> {
    const all = await this.list()
    const found = all.find((s) => s.id === id)
    if (!found) throw new Error('Signalement introuvable')
    const changed = apply(found)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.map((s) => (s.id === id ? changed : s))))
    return changed
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
