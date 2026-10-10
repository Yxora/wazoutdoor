import { listActiveSignalisations } from './listSignalisations'
import { scoreForecast } from '../domain/forecast'
import type { Place } from '../domain/place'
import type { ProtectedArea } from '../domain/protectedArea'
import type { Signalisation, SignalisationPreferences } from '../domain/signalisation'
import type { CriterionPreferences, Profile } from '../domain/profile'
import { ascentMeters, boundingBox, routeLengthMeters, sampleRoute, type Route, type SampledPoint } from '../domain/route'
import {
  computeScore,
  estimateDurationMinutes,
  scoreDaylight,
  scoreFire,
  scoreProtectedArea,
  scoreShelter,
  scoreSignalisations,
  scoreWater,
  scoreWeather,
  unknownCriterion,
  type CriterionResult,
  type SerenityScore,
} from '../domain/serenity'
import type {
  DaylightProvider,
  ElevationProvider,
  FireRiskProvider,
  ForecastProvider,
  PlaceProvider,
  ProtectedAreaProvider,
  SignalisationStore,
  WeatherAlertProvider,
} from './ports'

export interface EvaluationDeps {
  elevation: ElevationProvider
  daylight: DaylightProvider
  weather: WeatherAlertProvider
  forecast: ForecastProvider
  places: PlaceProvider
  fireRisk: FireRiskProvider
  protectedAreas: ProtectedAreaProvider
  signalisations: SignalisationStore
}

export interface EvaluationInput {
  route: Route
  profile: Profile
  start: Date
  /** Préférences de l'utilisateur sur les critères ; par défaut, tous ont un impact */
  preferences?: CriterionPreferences
  /** Traitement de chaque type de signalement ; par défaut, tous sont pris en compte */
  signalisationPreferences?: SignalisationPreferences
}

export interface RouteSummary {
  distanceKm: number
  /** null quand ni le fichier GPX ni le service d'altimétrie n'ont fourni l'altitude */
  ascentM: number | null
  durationMin: number
  end: Date
}

export interface Evaluation {
  summary: RouteSummary
  score: SerenityScore
  places: Place[]
  /** Zones protégées proches du tracé, pour l'affichage sur la carte ; vide si la source est indisponible */
  protectedAreas: ProtectedArea[]
  /** Signalements actifs reçus, gardés pour recalculer le critère sans rappeler la source ; null si indisponibles */
  signalisations: Signalisation[] | null
  routeSamples: SampledPoint[]
}

const SIGNALISATIONS_SOURCE = 'Signalements Wazoutdoor'
const SAMPLE_STEP_M = 250
const MAX_ELEVATION_POINTS = 100
const PLACES_MARGIN_DEGREES = 0.02
// Marge plus large que pour les lieux : couvre la zone de recherche de feux actifs autour du tracé (~10 km)
const FIRE_MARGIN_DEGREES = 0.15
// Juste assez pour couvrir le tracé lui-même : on ne teste que les zones qui le recouvrent réellement
const PROTECTED_AREA_MARGIN_DEGREES = 0.01

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function computeElevations(route: Route, deps: EvaluationDeps, lengthM: number): Promise<number[] | null> {
  const withElevation = route.points.filter((p) => p.ele !== undefined)
  if (withElevation.length === route.points.length && route.points.length > 1) {
    return withElevation.map((p) => p.ele as number)
  }
  try {
    const step = Math.max(SAMPLE_STEP_M, lengthM / MAX_ELEVATION_POINTS)
    const samples = sampleRoute(route.points, step)
    return await deps.elevation.elevations(samples)
  } catch {
    return null
  }
}

export async function evaluateRoute(deps: EvaluationDeps, input: EvaluationInput): Promise<Evaluation> {
  const { route, profile, start, preferences, signalisationPreferences } = input
  const lengthM = routeLengthMeters(route.points)
  const samples = sampleRoute(route.points, SAMPLE_STEP_M)
  const origin = route.points[0]

  const elevations = await computeElevations(route, deps, lengthM)
  const ascentM = elevations === null ? null : ascentMeters(elevations)
  const meanAltitudeM =
    elevations === null ? null : elevations.reduce((sum, z) => sum + z, 0) / elevations.length
  const durationMin = estimateDurationMinutes(lengthM, ascentM ?? 0, profile)
  const end = new Date(start.getTime() + durationMin * 60_000)

  const [daylight, weather, forecast, places, fire, protectedAreas, signalisationsFound] = await Promise.all([
    deps.daylight.sunset(origin, start).then(
      (sunset) => scoreDaylight(end, sunset, deps.daylight.source),
      (error): CriterionResult =>
        unknownCriterion('daylight', 'Retour avant la nuit', reason(error), deps.daylight.source),
    ),
    deps.weather.highestLevel(origin, start).then(
      (alert) => scoreWeather(alert.level, alert.department, deps.weather.source, alert.updatedAt),
      (error): CriterionResult => unknownCriterion('weather', 'Vigilance météo', reason(error), deps.weather.source),
    ),
    deps.forecast.hourly(origin, start, end, meanAltitudeM).then(
      (hours) => scoreForecast(hours, deps.forecast.source, meanAltitudeM),
      (error): CriterionResult =>
        unknownCriterion('forecast', 'Météo prévue pendant la sortie', reason(error), deps.forecast.source),
    ),
    deps.places.around(boundingBox(route.points, PLACES_MARGIN_DEGREES)).then(
      (found) => ({ found, error: null as string | null }),
      (error) => ({ found: [] as Place[], error: reason(error) }),
    ),
    deps.fireRisk.around(boundingBox(route.points, FIRE_MARGIN_DEGREES)).then(
      (detections) => scoreFire(samples, detections, deps.fireRisk.source),
      (error): CriterionResult => unknownCriterion('fire', 'Risque d’incendie', reason(error), deps.fireRisk.source),
    ),
    deps.protectedAreas.around(boundingBox(route.points, PROTECTED_AREA_MARGIN_DEGREES)).then(
      (areas) => ({ areas, criterion: scoreProtectedArea(samples, areas, deps.protectedAreas.source) }),
      (error) => ({
        areas: [] as ProtectedArea[],
        criterion: unknownCriterion('protectedArea', 'Zones protégées', reason(error), deps.protectedAreas.source),
      }),
    ),
    listActiveSignalisations(deps.signalisations).then(
      (found) => ({ found, error: null as string | null }),
      (error) => ({ found: null, error: reason(error) }),
    ),
  ])
  const signalisations =
    signalisationsFound.found === null
      ? unknownCriterion('signalisations', 'Signalements sur le parcours', signalisationsFound.error ?? '', SIGNALISATIONS_SOURCE)
      : scoreSignalisations(samples, signalisationsFound.found, SIGNALISATIONS_SOURCE, signalisationPreferences)

  const water: CriterionResult =
    places.error === null
      ? scoreWater(samples, places.found.filter((p) => p.kind === 'water'), profile, deps.places.source)
      : unknownCriterion('water', 'Points d’eau', places.error, deps.places.source)
  const shelter: CriterionResult =
    places.error === null
      ? scoreShelter(samples, places.found.filter((p) => p.kind === 'shelter'), profile, deps.places.source)
      : unknownCriterion('shelter', 'Abris et repli', places.error, deps.places.source)

  return {
    summary: { distanceKm: lengthM / 1000, ascentM, durationMin, end },
    score: computeScore([daylight, weather, forecast, water, shelter, fire, protectedAreas.criterion, signalisations], profile, preferences),
    places: places.found,
    protectedAreas: protectedAreas.areas,
    signalisations: signalisationsFound.found,
    routeSamples: samples,
  }
}

/** Recalcule le score d'une évaluation déjà faite avec d'autres préférences, sans rappeler les sources */
export function applyPreferences(
  evaluation: Evaluation,
  profile: Profile,
  preferences: CriterionPreferences,
  signalisationPreferences?: SignalisationPreferences,
): Evaluation {
  const criteria = evaluation.score.criteria.map((criterion) =>
    criterion.id === 'signalisations' && evaluation.signalisations !== null
      ? scoreSignalisations(evaluation.routeSamples, evaluation.signalisations, criterion.source, signalisationPreferences)
      : criterion,
  )
  return { ...evaluation, score: computeScore(criteria, profile, preferences) }
}
