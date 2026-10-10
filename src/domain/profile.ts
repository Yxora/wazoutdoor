export type ProfileId = 'randonneur' | 'traileur' | 'vttiste'

export type CriterionId = 'daylight' | 'weather' | 'forecast' | 'water' | 'shelter' | 'signalisations'

/** Comment un critère entre dans le score : absent, pondéré, ou éliminatoire (met le score à 0 s'il est en alerte) */
export type CriterionMode = 'ignore' | 'impact' | 'veto'

export type CriterionPreferences = Record<CriterionId, CriterionMode>

export const MODE_LABEL: Record<CriterionMode, string> = {
  ignore: 'Ignorer',
  impact: 'Prendre en compte',
  veto: 'Red flag',
}

export const CRITERION_LABEL: Record<CriterionId, string> = {
  daylight: 'Retour avant la nuit',
  weather: 'Vigilance météo',
  forecast: 'Météo prévue pendant la sortie',
  water: 'Points d’eau',
  shelter: 'Abris et repli',
  signalisations: 'Signalements sur le parcours',
}

export const DEFAULT_PREFERENCES: CriterionPreferences = {
  daylight: 'impact',
  weather: 'impact',
  forecast: 'impact',
  water: 'impact',
  shelter: 'impact',
  signalisations: 'impact',
}

/**
 * Hypothèses de travail, pas des valeurs validées : à confronter aux interviews.
 * Les vitesses suivent une règle de type Naismith (vitesse à plat + temps de montée).
 */
export interface Profile {
  id: ProfileId
  label: string
  flatSpeedKmh: number
  climbMetersPerHour: number
  /** Distance maximale acceptable entre deux points d'eau, en km */
  waterGapMaxKm: number
  /** Distance maximale acceptable à l'abri le plus proche, en km */
  shelterMaxKm: number
  weights: Record<CriterionId, number>
}

export const PROFILES: Record<ProfileId, Profile> = {
  randonneur: {
    id: 'randonneur',
    label: 'Randonneur·se',
    flatSpeedKmh: 5,
    climbMetersPerHour: 600,
    waterGapMaxKm: 10,
    shelterMaxKm: 3,
    weights: { daylight: 3, weather: 3, forecast: 3, water: 2, shelter: 2, signalisations: 2 },
  },
  traileur: {
    id: 'traileur',
    label: 'Traileur·se',
    flatSpeedKmh: 8,
    climbMetersPerHour: 900,
    waterGapMaxKm: 12,
    shelterMaxKm: 5,
    weights: { daylight: 3, weather: 3, forecast: 3, water: 3, shelter: 1, signalisations: 2 },
  },
  vttiste: {
    id: 'vttiste',
    label: 'Vététiste',
    flatSpeedKmh: 12,
    climbMetersPerHour: 500,
    waterGapMaxKm: 15,
    shelterMaxKm: 5,
    weights: { daylight: 3, weather: 3, forecast: 3, water: 2, shelter: 2, signalisations: 2 },
  },
}
