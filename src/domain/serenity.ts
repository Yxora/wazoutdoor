import type { FireDetection } from './fire'
import type { Place } from './place'
import { DEFAULT_PREFERENCES, effectiveMode, type CriterionId, type CriterionMode, type CriterionPreferences, type Profile } from './profile'
import { isPointInProtectedArea, type ProtectedArea } from './protectedArea'
import { distanceMeters, type SampledPoint } from './route'
import {
  DEFAULT_SIGNALISATION_PREFERENCES,
  reachMeters,
  SCORED_SIGNALISATION_TYPES,
  SIGNALISATION_TYPE_LABEL,
  freshness,
  isLive,
  signalisationStatus,
  type Signalisation,
  type SignalisationPreferences,
} from './signalisation'

export type CriterionStatus = 'ok' | 'warning' | 'alert' | 'unknown'

/** Un élément d'un critère composé (par exemple la pluie dans la météo prévue) */
export interface Facet {
  label: string
  status: CriterionStatus
  detail: string
}

export interface CriterionResult {
  id: CriterionId
  label: string
  status: CriterionStatus
  /** 0 à 100, null quand la donnée est indisponible */
  score: number | null
  detail: string
  source: string
  /** Fraîcheur de la donnée, quand la source la fournit */
  updatedAt?: Date
  facets?: Facet[]
  /** Renseigné par computeScore selon les préférences de l'utilisateur */
  mode?: CriterionMode
  /** Type de signalement réglé en « red flag » et présent sur le parcours : met le score à 0 */
  redFlag?: string
}

export type Verdict = 'serene' | 'caution' | 'alert'

export interface SerenityScore {
  /** Moyenne pondérée des critères disponibles, null si aucun */
  total: number | null
  verdict: Verdict | null
  /** Critère éliminatoire en alerte qui a mis le score à 0 */
  vetoedBy: CriterionId | null
  /** Critères disponibles parmi ceux qui comptent (les ignorés sont exclus) */
  availableCriteria: number
  totalCriteria: number
  criteria: CriterionResult[]
}

const WATER_REACH_M = 300

/** Pause comptée dans la durée de la sortie (repas, repos). Hypothèse de travail, à valider. */
export const BREAK_MINUTES = 60

/** Temps de marche (ou de roulage), sans la pause */
export function estimateDurationMinutes(distanceM: number, ascentM: number, profile: Profile): number {
  const flatHours = distanceM / 1000 / profile.flatSpeedKmh
  const climbHours = ascentM / profile.climbMetersPerHour
  return Math.round((flatHours + climbHours) * 60)
}

export function unknownCriterion(id: CriterionId, label: string, reason: string, source: string): CriterionResult {
  return { id, label, status: 'unknown', score: null, detail: `Donnée indisponible : ${reason}`, source }
}

export function scoreDaylight(endTime: Date, sunset: Date, source: string, updatedAt?: Date): CriterionResult {
  const marginMin = Math.round((sunset.getTime() - endTime.getTime()) / 60_000)
  const base = { id: 'daylight' as const, label: 'Retour avant la nuit', source, updatedAt }
  const margin = formatDuration(Math.abs(marginMin))

  if (marginMin >= 120) {
    return { ...base, status: 'ok', score: 100, detail: `Arrivée estimée ${margin} avant le coucher du soleil.` }
  }
  if (marginMin >= 60) {
    return { ...base, status: 'warning', score: 65, detail: `Marge réduite : arrivée estimée ${margin} avant le coucher du soleil.` }
  }
  if (marginMin > 0) {
    return { ...base, status: 'alert', score: 30, detail: `Marge très faible : arrivée estimée ${margin} avant le coucher du soleil.` }
  }
  return { ...base, status: 'alert', score: 0, detail: `Arrivée estimée ${margin} après le coucher du soleil.` }
}

const VIGILANCE_COLORS: Record<number, string> = { 1: 'verte', 2: 'jaune', 3: 'orange', 4: 'rouge' }

export function scoreWeather(level: number, department: string, source: string, updatedAt?: Date): CriterionResult {
  const base = { id: 'weather' as const, label: 'Vigilance météo', source, updatedAt }
  const color = VIGILANCE_COLORS[level] ?? 'inconnue'
  const detail = `Vigilance ${color} dans le département ${department} (niveau le plus élevé, tous phénomènes).`
  if (level <= 1) return { ...base, status: 'ok', score: 100, detail }
  if (level === 2) return { ...base, status: 'warning', score: 65, detail }
  if (level === 3) return { ...base, status: 'alert', score: 25, detail }
  return { ...base, status: 'alert', score: 0, detail }
}

function nearestSample(samples: SampledPoint[], place: Place): { distanceM: number; atMeters: number } {
  let best = { distanceM: Infinity, atMeters: 0 }
  for (const sample of samples) {
    const d = distanceMeters(sample, place.position)
    if (d < best.distanceM) best = { distanceM: d, atMeters: sample.atMeters }
  }
  return best
}

export function scoreWater(samples: SampledPoint[], waterPlaces: Place[], profile: Profile, source: string): CriterionResult {
  const base = { id: 'water' as const, label: 'Points d’eau', source }
  const lengthM = samples.length > 0 ? samples[samples.length - 1].atMeters : 0
  const maxKm = profile.waterGapMaxKm

  const reachable = waterPlaces
    .map((place) => nearestSample(samples, place))
    .filter((hit) => hit.distanceM <= WATER_REACH_M)
    .map((hit) => hit.atMeters)
    .sort((a, b) => a - b)

  const stops = [0, ...reachable, lengthM]
  let longestGapM = 0
  for (let i = 1; i < stops.length; i++) longestGapM = Math.max(longestGapM, stops[i] - stops[i - 1])
  const gapKm = longestGapM / 1000

  const count = reachable.length
  const caveat = ' À confirmer sur place : un point d’eau peut être à sec.'

  if (count === 0 && lengthM / 1000 <= maxKm) {
    return { ...base, status: 'ok', score: 90, detail: `Aucun point d’eau signalé, mais le parcours est court (${(lengthM / 1000).toFixed(1)} km).${caveat}` }
  }
  const detail = `${count} point(s) d’eau à moins de ${WATER_REACH_M} m du tracé. Plus long tronçon sans eau : ${gapKm.toFixed(1)} km (seuil du profil : ${maxKm} km).${caveat}`
  if (gapKm <= maxKm) return { ...base, status: 'ok', score: 100, detail }
  if (gapKm <= maxKm * 1.5) return { ...base, status: 'warning', score: 60, detail }
  return { ...base, status: 'alert', score: 20, detail }
}

export function scoreShelter(samples: SampledPoint[], shelters: Place[], profile: Profile, source: string): CriterionResult {
  const base = { id: 'shelter' as const, label: 'Abris et repli', source }
  const maxKm = profile.shelterMaxKm

  if (shelters.length === 0) {
    return {
      ...base,
      status: 'warning',
      score: 30,
      detail: 'Aucun abri connu à proximité. La donnée peut être incomplète : repérez vos points de repli avant de partir.',
    }
  }

  let worstM = 0
  for (const sample of samples) {
    const nearest = Math.min(...shelters.map((s) => distanceMeters(sample, s.position)))
    worstM = Math.max(worstM, nearest)
  }
  const worstKm = worstM / 1000
  const detail = `Au point le plus éloigné, l’abri connu le plus proche est à ${worstKm.toFixed(1)} km à vol d’oiseau (seuil du profil : ${maxKm} km).`
  if (worstKm <= maxKm) return { ...base, status: 'ok', score: 100, detail }
  if (worstKm <= maxKm * 2) return { ...base, status: 'warning', score: 60, detail }
  return { ...base, status: 'alert', score: 20, detail }
}

const FIRE_REACH_KM = 10
const FIRE_LOOKBACK_DAYS = 2

/** Distance du foyer actif le plus proche, en km, ou null si aucune détection sur le tracé */
function nearestFireKm(samples: SampledPoint[], detections: FireDetection[]): number | null {
  let nearestKm = Infinity
  for (const detection of detections) {
    for (const sample of samples) {
      const km = distanceMeters(sample, detection.position) / 1000
      if (km < nearestKm) nearestKm = km
    }
  }
  return Number.isFinite(nearestKm) ? nearestKm : null
}

export function scoreFire(
  samples: SampledPoint[],
  detections: FireDetection[],
  source: string,
  updatedAt?: Date,
): CriterionResult {
  const base = { id: 'fire' as const, label: 'Risque d’incendie', source, updatedAt }
  const nearestKm = nearestFireKm(samples, detections)

  if (nearestKm === null || nearestKm > FIRE_REACH_KM) {
    return {
      ...base,
      status: 'ok',
      score: 100,
      detail: `Aucun feu actif détecté par satellite (MODIS/VIIRS) à moins de ${FIRE_REACH_KM} km du tracé, sur les ${FIRE_LOOKBACK_DAYS} derniers jours.`,
    }
  }

  const nearby = detections.filter((d) => samples.some((s) => distanceMeters(s, d.position) / 1000 <= FIRE_REACH_KM))
  return {
    ...base,
    status: 'alert',
    score: 0,
    detail: `${nearby.length} détection(s) satellite de feu actif (MODIS/VIIRS) à moins de ${FIRE_REACH_KM} km du tracé, la plus proche à ${nearestKm.toFixed(1)} km. Itinéraire déconseillé : vérifiez les fermetures et consignes officielles avant de partir.`,
  }
}

export function scoreProtectedArea(samples: SampledPoint[], areas: ProtectedArea[], source: string): CriterionResult {
  const base = { id: 'protectedArea' as const, label: 'Zones protégées', source }
  const entered = areas.filter((area) => samples.some((s) => isPointInProtectedArea(s, area)))

  if (entered.length === 0) {
    return {
      ...base,
      status: 'ok',
      score: 100,
      detail: 'Le tracé ne traverse aucune zone protégée répertoriée (réserve naturelle, arrêté de biotope, parc national).',
    }
  }

  const facets: Facet[] = entered.map((area) => ({
    label: area.category,
    status: 'warning',
    detail: area.name,
  }))

  return {
    ...base,
    status: 'warning',
    score: 60,
    detail: `Le tracé traverse ${entered.length} zone(s) protégée(s). Attention à la réglementation en vigueur (sentiers balisés, périodes de quiétude, cueillette, chiens...).`,
    facets,
  }
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(meters / 10) * 10} m`
}

function ageLabel(createdAt: Date, now: Date): string {
  const days = Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000)
  if (days < 1) return 'signalé aujourd’hui'
  return days === 1 ? 'signalé hier' : `signalé il y a ${days} jours`
}

export function scoreSignalisations(
  samples: SampledPoint[],
  signalisations: Signalisation[],
  source: string,
  typeModes: SignalisationPreferences = DEFAULT_SIGNALISATION_PREFERENCES,
  now = new Date(),
): CriterionResult {
  const base = { id: 'signalisations' as const, label: 'Signalements sur le parcours', source }
  const onRoute = signalisations
    .filter((signalisation) => isLive(signalisation, now))
    .filter((signalisation) => SCORED_SIGNALISATION_TYPES.includes(signalisation.type) && typeModes[signalisation.type] !== 'ignore')
    .map((signalisation) => ({
      signalisation,
      distanceM: Math.min(...samples.map((sample) => distanceMeters(sample, signalisation.position))),
    }))
    .filter((hit) => hit.distanceM <= reachMeters(hit.signalisation.type))
    .sort((a, b) => a.distanceM - b.distanceM)

  if (onRoute.length === 0) {
    return {
      ...base,
      status: 'ok',
      score: 100,
      detail: `Aucun signalement actif dans la zone d’effet du tracé. Cela ne garantit pas l’absence d’imprévu : peu de monde signale encore.`,
    }
  }

  const isRedFlag = (type: Signalisation['type']) => typeModes[type] === 'veto'
  const facets: Facet[] = onRoute.map(({ signalisation, distanceM }) => {
    const toConfirm = signalisationStatus(signalisation, now) === 'to_confirm' ? ', à confirmer' : ''
    const where = `à ${formatDistance(distanceM)} du tracé (zone d’effet : ${formatDistance(reachMeters(signalisation.type))}), ${ageLabel(signalisation.createdAt, now)}${toConfirm}`
    return {
      label: SIGNALISATION_TYPE_LABEL[signalisation.type] + (isRedFlag(signalisation.type) ? ' (red flag)' : ''),
      status: isRedFlag(signalisation.type) ? 'alert' : 'warning',
      detail: signalisation.description ? `${signalisation.description} (${where})` : where,
    }
  })
  const detail = `${onRoute.length} signalement(s) dans la zone d’effet du tracé. Détail ci-dessous.`
  const redFlag = onRoute.find((hit) => isRedFlag(hit.signalisation.type))
  // Un signalement qui vieillit pèse moins (voir `freshness`) ; un type en red flag reste éliminatoire tant qu'il est affiché
  const weights = onRoute.map(({ signalisation }) => freshness(signalisation, now))
  const alert = redFlag !== undefined || weights.reduce((sum, w) => sum + w, 0) >= 3
  return {
    ...base,
    status: alert ? 'alert' : 'warning',
    score: alert ? 20 : 100 - Math.round(40 * Math.max(...weights)),
    detail,
    facets,
    redFlag: redFlag && SIGNALISATION_TYPE_LABEL[redFlag.signalisation.type],
  }
}

export function computeScore(
  results: CriterionResult[],
  profile: Profile,
  preferences: CriterionPreferences = DEFAULT_PREFERENCES,
): SerenityScore {
  const criteria = results.map((c) => ({
    ...c,
    // L'incendie reste éliminatoire et la zone protégée ne peut pas être ignorée, quelles que soient les préférences
    mode: effectiveMode(c.id, preferences[c.id]),
  }))
  const counted = criteria.filter((c) => c.mode !== 'ignore')
  const available = counted.filter((c): c is typeof c & { score: number } => c.score !== null)
  const weightSum = available.reduce((sum, c) => sum + profile.weights[c.id], 0)
  const weighted =
    weightSum === 0
      ? null
      : Math.round(available.reduce((sum, c) => sum + c.score * profile.weights[c.id], 0) / weightSum)

  // Un critère éliminatoire en alerte met le score à 0, même si les autres sont bons
  const vetoedBy = counted.find((c) => (c.mode === 'veto' && c.status === 'alert') || c.redFlag)?.id ?? null
  const total = weighted === null ? null : vetoedBy === null ? weighted : 0

  const alerts = counted.filter((c) => c.status === 'alert').length
  let verdict: Verdict | null = null
  if (total !== null) {
    if (total < 50 || alerts >= 2) verdict = 'alert'
    else if (total >= 80 && alerts === 0) verdict = 'serene'
    else verdict = 'caution'
  }

  return { total, verdict, vetoedBy, availableCriteria: available.length, totalCriteria: counted.length, criteria }
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
