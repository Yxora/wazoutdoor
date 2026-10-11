import type { Coordinates } from './coordinates'
import type { CriterionMode } from './profile'
import { distanceMeters } from './route'

/** Danger ponctuel pouvant gêner une sortie outdoor (rando, trail, VTT) */
export type SignalisationType =
  | 'eboulis'
  | 'arbre'
  | 'boue'
  | 'neige'
  | 'eau'
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
  /** Photo jointe pour qualifier le signalement (adresse publique) */
  photoUrl?: string
  /** Nombre de personnes ayant indiqué « plus là » depuis la dernière confirmation (0 si absent) */
  goneVotes?: number
  /** Commentaires d'autres utilisateur·rices, du plus ancien au plus récent */
  comments?: string[]
}

export const SIGNALISATION_TYPE_LABEL: Record<SignalisationType, string> = {
  eboulis: 'Éboulis ou obstacle',
  arbre: 'Arbre tombé',
  boue: 'Boue, passage glissant',
  neige: 'Neige, verglas',
  eau: 'Crue, passage d’eau dangereux',
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

/**
 * Types pris en compte dans le critère « Signalements » et réglables par l'utilisateur. Le feu de
 * forêt n'est plus un type de signalement manuel : il est mesuré en continu par satellite (NASA
 * FIRMS, voir `domain/fire.ts` et le critère `fire`), donc tous les types restants comptent.
 */
export const SCORED_SIGNALISATION_TYPES: SignalisationType[] = SIGNALISATION_TYPES

/** Rayon autour du tracé dans lequel un signalement compte, par défaut. Hypothèse de travail, à valider. */
export const DEFAULT_REACH_M = 150

/** Certains dangers portent bien plus loin que le tracé : une battue de chasse concerne 3 km alentour. */
const REACH_M_BY_TYPE: Partial<Record<SignalisationType, number>> = {
  chasse: 3000,
}

export function reachMeters(type: SignalisationType): number {
  return REACH_M_BY_TYPE[type] ?? DEFAULT_REACH_M
}

const DESCRIPTION_MAX_LENGTH = 280

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Durée au-delà de laquelle un signalement n'est plus affiché, faute de confirmation. Dépend de la vitesse à laquelle le
 * danger disparaît : une battue dure quelques heures, un arbre tombé reste des semaines. Hypothèses de travail, à valider.
 */
const VALIDITY_MS_BY_TYPE: Record<SignalisationType, number> = {
  chasse: 12 * HOUR_MS,
  brouillard: 6 * HOUR_MS,
  boue: 3 * DAY_MS,
  neige: 3 * DAY_MS,
  eau: 3 * DAY_MS,
  troupeau: 14 * DAY_MS,
  autre: 14 * DAY_MS,
  arbre: 21 * DAY_MS,
  eboulis: 21 * DAY_MS,
  dechets: 21 * DAY_MS,
  balisage: 90 * DAY_MS,
}

export function validityMs(type: SignalisationType): number {
  return VALIDITY_MS_BY_TYPE[type]
}

/** Nombre de « plus là » (de personnes différentes) qui ferment un signalement */
export const GONE_VOTES_TO_RESOLVE = 2

/** Moment de la vie du signalement, de sa création à sa disparition */
export type SignalisationStatus = 'active' | 'to_confirm' | 'expired' | 'resolved'

export interface NewSignalisation {
  type: SignalisationType
  description: string
  position: Coordinates
  photoUrl?: string
}

/** Signalé à l'instant, sur la position GPS de l'utilisateur·rice */
export function createSignalisation(input: NewSignalisation, now = new Date()): Signalisation {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    description: input.description.trim().slice(0, DESCRIPTION_MAX_LENGTH),
    position: input.position,
    createdAt: now,
    ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
  }
}

function ageMs(signalisation: Signalisation, now: Date): number {
  return now.getTime() - signalisation.createdAt.getTime()
}

export function isExpired(signalisation: Signalisation, now: Date): boolean {
  return ageMs(signalisation, now) > validityMs(signalisation.type)
}

export function isResolved(signalisation: Signalisation): boolean {
  return (signalisation.goneVotes ?? 0) >= GONE_VOTES_TO_RESOLVE
}

/** Quelqu'un a dit « plus là » mais pas encore assez de personnes pour le résoudre : à vérifier */
export function isGonePending(signalisation: Signalisation): boolean {
  return !isResolved(signalisation) && (signalisation.goneVotes ?? 0) > 0
}

/**
 * Résolu (assez de « plus là ») ou expiré : plus affiché ni compté. « À confirmer » : passé la moitié de sa durée de
 * validité, encore affiché et compté, mais avec moins de poids.
 */
export function signalisationStatus(signalisation: Signalisation, now: Date): SignalisationStatus {
  if (isResolved(signalisation)) return 'resolved'
  if (isExpired(signalisation, now)) return 'expired'
  return ageMs(signalisation, now) > validityMs(signalisation.type) / 2 ? 'to_confirm' : 'active'
}

/** Affiché et compté dans le score */
export function isLive(signalisation: Signalisation, now: Date): boolean {
  const status = signalisationStatus(signalisation, now)
  return status === 'active' || status === 'to_confirm'
}

/** Poids d'un signalement dans le score : 1 jusqu'à la moitié de sa durée de validité, puis décroît jusqu'à 0,4 à l'expiration */
export function freshness(signalisation: Signalisation, now: Date): number {
  const ratio = ageMs(signalisation, now) / validityMs(signalisation.type)
  if (ratio <= 0.5) return 1
  return Math.max(0.4, 1 - 1.2 * (ratio - 0.5))
}

/** « Toujours là » : la date repart de maintenant et les « plus là » sont remis à zéro */
export function confirmSignalisation(signalisation: Signalisation, now = new Date()): Signalisation {
  return { ...signalisation, createdAt: now, goneVotes: 0 }
}

/** « Plus là » : une voix de plus ; à deux voix le signalement est résolu */
export function reportGone(signalisation: Signalisation): Signalisation {
  return { ...signalisation, goneVotes: (signalisation.goneVotes ?? 0) + 1 }
}

export interface NearbySignalisations {
  /** Signalement actif de même type le plus proche, dans sa zone d'effet */
  sameType?: { signalisation: Signalisation; distanceM: number }
  /** Signalements actifs d'un autre type, assez proches pour se recouvrir, du plus proche au plus loin */
  otherTypes: { signalisation: Signalisation; distanceM: number }[]
}

/**
 * Signalements déjà présents autour d'une position. « Proche » = à moins de la zone d'effet du type (voir `reachMeters`) ;
 * entre deux types différents, on retient la plus petite des deux zones, pour qu'une battue de chasse (3 km) ne bloque
 * pas le signalement d'un arbre tombé 2 km plus loin. Hypothèse de travail, à valider.
 */
export function findNearbySignalisations(
  position: Coordinates,
  type: SignalisationType,
  existing: Signalisation[],
  now = new Date(),
): NearbySignalisations {
  const result: NearbySignalisations = { otherTypes: [] }
  const withDistance = existing
    .filter((s) => isLive(s, now))
    .map((signalisation) => ({ signalisation, distanceM: distanceMeters(position, signalisation.position) }))
    .sort((a, b) => a.distanceM - b.distanceM)
  for (const item of withDistance) {
    const reach = Math.min(reachMeters(type), reachMeters(item.signalisation.type))
    if (item.distanceM > reach) continue
    if (item.signalisation.type === type) result.sameType ??= item
    else result.otherTypes.push(item)
  }
  return result
}

export const MAX_COMMENT_LENGTH = 140
export const MAX_COMMENTS = 10

/** Commentaire ajouté par une autre personne (« passage contourné par la gauche »). Vide ou au-delà de la limite : inchangé. */
export function addComment(signalisation: Signalisation, text: string): Signalisation {
  const comment = text.trim().slice(0, MAX_COMMENT_LENGTH)
  const comments = signalisation.comments ?? []
  if (!comment || comments.length >= MAX_COMMENTS) return signalisation
  return { ...signalisation, comments: [...comments, comment] }
}
