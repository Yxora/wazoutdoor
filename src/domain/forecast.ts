import type { CriterionResult, CriterionStatus, Facet } from './serenity'

export interface HourlyForecast {
  time: Date
  /** Température ressentie, en °C */
  apparentTemperature: number
  precipitationMm: number
  /** Probabilité de précipitation en %, absente selon les modèles */
  precipitationProbability: number | null
  windGustKmh: number
  /** Code météo WMO */
  weatherCode: number
}

/**
 * Seuils de travail, pas des valeurs validées : à confronter aux interviews et à l'avis de pratiquants.
 */
export const FORECAST_THRESHOLDS = {
  rainWarningMm: 2,
  rainAlertMm: 8,
  rainWarningProbability: 60,
  coldWarningC: 2,
  coldAlertC: -5,
  heatWarningC: 28,
  heatAlertC: 35,
  gustWarningKmh: 60,
  gustAlertKmh: 90,
} as const

const THUNDERSTORM_CODES = new Set([95, 96, 99])
const FACET_SCORE: Record<Exclude<CriterionStatus, 'unknown'>, number> = { ok: 100, warning: 65, alert: 20 }
const SEVERITY: Record<CriterionStatus, number> = { ok: 0, unknown: 0, warning: 1, alert: 2 }

const rounded = (n: number) => Math.round(n)

function rainFacet(hours: HourlyForecast[]): Facet {
  const t = FORECAST_THRESHOLDS
  const total = hours.reduce((sum, h) => sum + h.precipitationMm, 0)
  const probabilities = hours.map((h) => h.precipitationProbability).filter((p): p is number => p !== null)
  const maxProbability = probabilities.length > 0 ? Math.max(...probabilities) : null
  const probabilityText = maxProbability === null ? '' : `, probabilité jusqu’à ${rounded(maxProbability)} %`
  const detail = `${total.toFixed(1)} mm cumulés${probabilityText}`

  let status: CriterionStatus = 'ok'
  if (total >= t.rainAlertMm) status = 'alert'
  else if (total >= t.rainWarningMm || (maxProbability ?? 0) >= t.rainWarningProbability) status = 'warning'
  return { label: 'Pluie', status, detail }
}

function temperatureFacet(hours: HourlyForecast[]): Facet {
  const t = FORECAST_THRESHOLDS
  const values = hours.map((h) => h.apparentTemperature)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const detail = `Ressenti de ${rounded(min)} °C à ${rounded(max)} °C`

  if (min <= t.coldAlertC) return { label: 'Froid', status: 'alert', detail: `${detail} : grand froid` }
  if (max >= t.heatAlertC) return { label: 'Chaleur', status: 'alert', detail: `${detail} : canicule` }
  if (min <= t.coldWarningC) return { label: 'Froid', status: 'warning', detail: `${detail} : prévoir des couches, risque de verglas` }
  if (max >= t.heatWarningC) return { label: 'Chaleur', status: 'warning', detail: `${detail} : prévoir beaucoup d’eau` }
  return { label: 'Température', status: 'ok', detail }
}

function windFacet(hours: HourlyForecast[]): Facet {
  const t = FORECAST_THRESHOLDS
  const gust = Math.max(...hours.map((h) => h.windGustKmh))
  const detail = `Rafales jusqu’à ${rounded(gust)} km/h`
  if (gust >= t.gustAlertKmh) return { label: 'Vent', status: 'alert', detail }
  if (gust >= t.gustWarningKmh) return { label: 'Vent', status: 'warning', detail }
  return { label: 'Vent', status: 'ok', detail }
}

function thunderFacet(hours: HourlyForecast[]): Facet {
  const stormy = hours.some((h) => THUNDERSTORM_CODES.has(h.weatherCode))
  return stormy
    ? { label: 'Orage', status: 'alert', detail: 'Orage prévu pendant la sortie' }
    : { label: 'Orage', status: 'ok', detail: 'Pas d’orage prévu' }
}

/** Évalue les prévisions sur la durée de la sortie. Le statut global est celui du pire élément. */
export function scoreForecast(hours: HourlyForecast[], source: string, altitudeM: number | null): CriterionResult {
  const base = { id: 'forecast' as const, label: 'Météo prévue pendant la sortie', source }
  if (hours.length === 0) {
    return { ...base, status: 'unknown', score: null, detail: 'Donnée indisponible : aucune prévision sur la période.' }
  }

  const facets = [rainFacet(hours), temperatureFacet(hours), windFacet(hours), thunderFacet(hours)]
  const worst = facets.reduce((a, b) => (SEVERITY[b.status] > SEVERITY[a.status] ? b : a))
  const score = Math.min(...facets.map((f) => FACET_SCORE[f.status as keyof typeof FACET_SCORE]))
  const where = altitudeM === null ? 'au point de départ' : `vers ${rounded(altitudeM)} m d’altitude`

  return {
    ...base,
    status: worst.status,
    score,
    detail: `Prévisions horaires ${where}, pendant la durée estimée de la sortie.`,
    facets,
  }
}
