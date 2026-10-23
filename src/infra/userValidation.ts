import { DEFAULT_PREFERENCES, PROFILES, type CriterionPreferences, type ProfileId } from '../domain/profile'
import { DEFAULT_SIGNALISATION_PREFERENCES, SIGNALISATION_TYPES } from '../domain/signalisation'
import type { User } from '../domain/user'

const MODES = ['ignore', 'impact', 'veto']

/**
 * Relit des préférences venues du navigateur ou de la base : activité ou mode inconnu = valeur par défaut,
 * aucune activité valable = `fallback` en entier.
 */
export function parseUser(stored: unknown, fallback: User): User {
  if (!stored || typeof stored !== 'object') return fallback
  const { activities: rawActivities, preferences: rawPreferences, signalisationPreferences: rawSignalisation } = stored as Partial<User>
  const activities = (Array.isArray(rawActivities) ? rawActivities : []).filter((id): id is ProfileId => id in PROFILES)
  if (activities.length === 0) return fallback
  const preferences = { ...DEFAULT_PREFERENCES }
  for (const id of Object.keys(preferences) as (keyof CriterionPreferences)[]) {
    const mode = rawPreferences?.[id]
    if (mode && MODES.includes(mode)) preferences[id] = mode
  }
  const signalisationPreferences = { ...DEFAULT_SIGNALISATION_PREFERENCES }
  for (const type of SIGNALISATION_TYPES) {
    const mode = rawSignalisation?.[type]
    if (mode && MODES.includes(mode)) signalisationPreferences[type] = mode
  }
  return { ...fallback, activities, preferences, signalisationPreferences }
}
