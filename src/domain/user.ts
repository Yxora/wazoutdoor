import { DEFAULT_SIGNALISATION_PREFERENCES, type SignalisationPreferences } from './signalisation'
import { DEFAULT_PREFERENCES, type CriterionPreferences, type ProfileId } from './profile'

export interface User {
  id: string
  name: string
  /** Activités pratiquées : seuls ces profils sont proposés dans le panel */
  activities: ProfileId[]
  preferences: CriterionPreferences
  /** Traitement de chaque type de signalement, quand le critère « Signalements » est pris en compte */
  signalisationPreferences: SignalisationPreferences
}

/** Utilisateur fictif pour la démo (hypothèse de persona, pas une donnée d'enquête). Tous les critères sont pris en compte au départ. */
export const DEMO_USER: User = {
  id: 'julie',
  name: 'Julie',
  activities: ['randonneur', 'traileur'],
  preferences: { ...DEFAULT_PREFERENCES },
  signalisationPreferences: { ...DEFAULT_SIGNALISATION_PREFERENCES },
}
