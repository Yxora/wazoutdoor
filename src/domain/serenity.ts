import type { FireDetection } from './fire'
import type { Place } from './place'
import { isPointInProtectedArea, type ProtectedArea } from './protectedArea'
import type { CriterionId, Profile } from './profile'
import { distanceMeters, type SampledPoint } from './route'

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
}

export type Verdict = 'serene' | 'caution' | 'alert'

export interface SerenityScore {
  /** Moyenne pondérée des critères disponibles, null si aucun */
  total: number | null
  verdict: Verdict | null
  availableCriteria: number
  totalCriteria: number
  criteria: CriterionResult[]
}

const WATER_REACH_M = 300

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
    detail: area.url ? `${area.name} — ${area.url}` : area.name,
  }))

  return {
    ...base,
    status: 'warning',
    score: 60,
    detail: `Le tracé traverse ${entered.length} zone(s) protégée(s). Attention à la réglementation en vigueur (sentiers balisés, périodes de quiétude, cueillette, chiens...).`,
    facets,
  }
}

export function computeScore(criteria: CriterionResult[], profile: Profile): SerenityScore {
  const available = criteria.filter((c): c is CriterionResult & { score: number } => c.score !== null)
  const availableCriteria = available.length
  const totalCriteria = criteria.length

  // Un risque d'incendie avéré rend le tracé dangereux quels que soient les autres critères : le score est forcé à 0.
  const fireAlert = criteria.some((c) => c.id === 'fire' && c.status === 'alert')
  if (fireAlert) {
    return { total: 0, verdict: 'alert', availableCriteria, totalCriteria, criteria }
  }

  const weightSum = available.reduce((sum, c) => sum + profile.weights[c.id], 0)
  const total =
    weightSum === 0
      ? null
      : Math.round(available.reduce((sum, c) => sum + c.score * profile.weights[c.id], 0) / weightSum)

  const alerts = criteria.filter((c) => c.status === 'alert').length
  let verdict: Verdict | null = null
  if (total !== null) {
    if (total < 50 || alerts >= 2) verdict = 'alert'
    else if (total >= 80 && alerts === 0) verdict = 'serene'
    else verdict = 'caution'
  }

  return { total, verdict, availableCriteria, totalCriteria, criteria }
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`
}
