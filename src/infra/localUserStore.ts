import type { UserStore } from '../application/ports'
import { DEFAULT_PREFERENCES, PROFILES, type CriterionPreferences, type ProfileId } from '../domain/profile'
import { DEFAULT_SIGNALISATION_PREFERENCES, SIGNALISATION_TYPES } from '../domain/signalisation'
import { DEMO_USER, type User } from '../domain/user'

const STORAGE_KEY = 'wazoutdoor:user:v2'
const MODES = ['ignore', 'impact', 'veto']

/** Garde les préférences dans le navigateur ; toute donnée absente ou invalide retombe sur `fallback` (la démo par défaut). */
export class LocalUserStore implements UserStore {
  constructor(
    private readonly storage: Storage = localStorage,
    private readonly fallback: User = DEMO_USER,
  ) {}

  get(): User {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      if (!raw) return this.fallback
      const stored = JSON.parse(raw) as Partial<User>
      const activities = (stored.activities ?? []).filter((id): id is ProfileId => id in PROFILES)
      if (activities.length === 0) return this.fallback
      const preferences = { ...DEFAULT_PREFERENCES }
      for (const id of Object.keys(preferences) as (keyof CriterionPreferences)[]) {
        const mode = stored.preferences?.[id]
        if (mode && MODES.includes(mode)) preferences[id] = mode
      }
      const signalisationPreferences = { ...DEFAULT_SIGNALISATION_PREFERENCES }
      for (const type of SIGNALISATION_TYPES) {
        const mode = stored.signalisationPreferences?.[type]
        if (mode && MODES.includes(mode)) signalisationPreferences[type] = mode
      }
      return { ...this.fallback, activities, preferences, signalisationPreferences }
    } catch {
      return this.fallback
    }
  }

  save(user: User): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(user))
    } catch {
      // stockage indisponible (navigation privée) : les choix durent le temps de la page
    }
  }
}
