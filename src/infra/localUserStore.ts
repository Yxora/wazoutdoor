import type { UserStore } from '../application/ports'
import { DEMO_USER, type User } from '../domain/user'
import { parseUser } from './userValidation'

const STORAGE_KEY = 'wazoutdoor:user:v2'

/**
 * Garde les préférences dans le navigateur, pour la démo hors ligne (sans Supabase) ;
 * toute donnée absente ou invalide retombe sur `fallback` (la démo par défaut).
 */
export class LocalUserStore implements UserStore {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly fallback: User = DEMO_USER,
  ) {}

  get(): User {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      return raw ? parseUser(JSON.parse(raw), this.fallback) : this.fallback
    } catch {
      return this.fallback
    }
  }

  /** Tout est déjà dans le navigateur */
  async load(): Promise<User> {
    return this.get()
  }

  save(user: User): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(user))
    } catch {
      // stockage indisponible (navigation privée) : les choix durent le temps de la page
    }
  }

  /** Un seul profil local (Julie, toujours connectée) : rien à effacer */
  clear(): void {}
}
