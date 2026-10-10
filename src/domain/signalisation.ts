import type { Coordinates } from './coordinates'
import type { CriterionMode } from './profile'

/** Danger ponctuel pouvant gêner une sortie outdoor (rando, trail, VTT) */
export type SignalisationType =
  | 'eboulis'
  | 'arbre'
  | 'boue'
  | 'neige'
  | 'eau'
  | 'incendie'
  | 'chasse'
  | 'troupeau'
  | 'balisage'
  | 'brouillard'
  | 'dechets'
  | 'autre'

export interface Signalisation {
  id: string
  type: SignalisationType
  description: string
  position: Coordinates
  createdAt: Date
}

export const SIGNALISATION_TYPE_LABEL: Record<SignalisationType, string> = {
  eboulis: 'Éboulis ou obstacle',
  arbre: 'Arbre tombé',
  boue: 'Boue, passage glissant',
  neige: 'Neige, verglas',
  eau: 'Crue, passage d’eau dangereux',
  incendie: 'Feu de forêt',
  chasse: 'Chasse en cours',
  troupeau: 'Troupeau, patous',
  balisage: 'Balisage absent',
  brouillard: 'Brouillard dense',
  dechets: 'Déchets présents',
  autre: 'Autre danger',
}

export const SIGNALISATION_TYPES = Object.keys(SIGNALISATION_TYPE_LABEL) as SignalisationType[]

/** Mode choisi par l'utilisateur pour chaque type de signalement (ignorer, prendre en compte, red flag) */
export type SignalisationPreferences = Record<SignalisationType, CriterionMode>

export const DEFAULT_SIGNALISATION_PREFERENCES = Object.fromEntries(
  SIGNALISATION_TYPES.map((type) => [type, 'impact']),
) as SignalisationPreferences

/** Types pris en compte dans le score et réglables par l'utilisateur. Le feu de forêt reste signalable et visible sur la carte, mais n'entre pas dans le score. */
export const SCORED_SIGNALISATION_TYPES: SignalisationType[] = SIGNALISATION_TYPES.filter((type) => type !== 'incendie')

/** Rayon autour du tracé dans lequel un signalement compte, par défaut. Hypothèse de travail, à valider. */
export const DEFAULT_REACH_M = 150

/** Certains dangers portent bien plus loin que le tracé : une battue de chasse concerne 3 km alentour. */
const REACH_M_BY_TYPE: Partial<Record<SignalisationType, number>> = {
  chasse: 3000,
}

export function reachMeters(type: SignalisationType): number {
  return REACH_M_BY_TYPE[type] ?? DEFAULT_REACH_M
}

/** Signalements qui bloquent le passage ou mettent en danger immédiat : affichage distinct (forme ET couleur, jamais la couleur seule). */
const CRITICAL_SIGNALISATION_TYPES: SignalisationType[] = ['incendie']

export function isCritical(type: SignalisationType): boolean {
  return CRITICAL_SIGNALISATION_TYPES.includes(type)
}

const DESCRIPTION_MAX_LENGTH = 280

/** Durée au-delà de laquelle un signalement n'est plus affiché, faute de confirmation */
const VALIDITY_DAYS = 30

export interface NewSignalisation {
  type: SignalisationType
  description: string
  position: Coordinates
}

/** Signalé à l'instant, sur la position GPS de l'utilisateur·rice */
export function createSignalisation(input: NewSignalisation, now = new Date()): Signalisation {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    description: input.description.trim().slice(0, DESCRIPTION_MAX_LENGTH),
    position: input.position,
    createdAt: now,
  }
}

export function isExpired(signalisation: Signalisation, now: Date): boolean {
  const ageMs = now.getTime() - signalisation.createdAt.getTime()
  return ageMs > VALIDITY_DAYS * 24 * 60 * 60 * 1000
}
