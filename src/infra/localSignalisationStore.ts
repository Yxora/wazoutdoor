import type { SignalisationStore } from '../application/ports'
import { addComment, ALREADY_VOTED_GONE, confirmSignalisation, markResolved, NOT_OWNER, reportGone, type Signalisation } from '../domain/signalisation'

const STORAGE_KEY = 'wazoutdoor:signalisations'
/** Sans serveur, une seule personne utilise le navigateur : ses votes « plus là » y sont gardés */
const GONE_VOTES_KEY = 'wazoutdoor:gone-voted'
/** Signalements créés dans ce navigateur : leur auteur·rice peut les retirer */
const MINE_KEY = 'wazoutdoor:my-signalisations'

type StoredSignalisation = Omit<Signalisation, 'createdAt' | 'resolvedAt'> & { createdAt: string; resolvedAt?: string }

/** Stocke les signalements dans le navigateur. En attendant un vrai backend communautaire (Supabase). */
export class LocalSignalisationStore implements SignalisationStore {
  async save(signalisation: Signalisation): Promise<void> {
    const all = await this.list()
    all.push(signalisation)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    this.writeIds(MINE_KEY, [...(await this.mySignalisations()), signalisation.id])
  }

  async confirm(id: string): Promise<Signalisation> {
    const confirmed = await this.change(id, (s) => confirmSignalisation(s))
    this.writeGoneVotes((await this.myGoneVotes()).filter((voted) => voted !== id))
    return confirmed
  }

  async reportGone(id: string): Promise<Signalisation> {
    // Son propre signalement : l'auteur·rice sait que le danger a disparu
    if ((await this.mySignalisations()).includes(id)) return this.change(id, (s) => markResolved(s))
    const voted = await this.myGoneVotes()
    if (voted.includes(id)) throw new Error(ALREADY_VOTED_GONE)
    const updated = await this.change(id, reportGone)
    this.writeGoneVotes([...voted, id])
    return updated
  }

  async myGoneVotes(): Promise<string[]> {
    return this.readIds(GONE_VOTES_KEY)
  }

  async mySignalisations(): Promise<string[]> {
    return this.readIds(MINE_KEY)
  }

  async remove(id: string): Promise<void> {
    await this.requireMine(id)
    const all = await this.list()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((s) => s.id !== id)))
    this.writeIds(MINE_KEY, (await this.mySignalisations()).filter((mine) => mine !== id))
  }

  private async requireMine(id: string): Promise<void> {
    if (!(await this.mySignalisations()).includes(id)) throw new Error(NOT_OWNER)
  }

  private readIds(key: string): string[] {
    try {
      const ids = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  }

  private writeIds(key: string, ids: string[]): void {
    localStorage.setItem(key, JSON.stringify(ids))
  }

  private writeGoneVotes(ids: string[]): void {
    this.writeIds(GONE_VOTES_KEY, ids)
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
      return stored.map(({ resolvedAt, ...s }) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        ...(resolvedAt ? { resolvedAt: new Date(resolvedAt) } : {}),
      }))
    } catch {
      return []
    }
  }
}
