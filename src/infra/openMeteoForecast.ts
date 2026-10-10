import type { ForecastProvider } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'
import type { HourlyForecast } from '../domain/forecast'

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const HOURLY = 'apparent_temperature,precipitation,precipitation_probability,wind_gusts_10m,weather_code'
const HOUR_MS = 3_600_000

interface HourlyResponse {
  hourly?: {
    time: string[]
    apparent_temperature: (number | null)[]
    precipitation: (number | null)[]
    precipitation_probability?: (number | null)[]
    wind_gusts_10m: (number | null)[]
    weather_code: (number | null)[]
  }
}

const utcDay = (date: Date) => date.toISOString().slice(0, 10)

export class OpenMeteoForecast implements ForecastProvider {
  readonly source = 'Open-Meteo (usage non commercial)'

  async hourly(at: Coordinates, from: Date, to: Date, altitudeM: number | null): Promise<HourlyForecast[]> {
    // Heures entières couvrant la sortie : début arrondi vers le bas, fin vers le haut
    const first = Math.floor(from.getTime() / HOUR_MS) * HOUR_MS
    const last = Math.ceil(to.getTime() / HOUR_MS) * HOUR_MS

    const elevation = altitudeM === null ? '' : `&elevation=${Math.round(altitudeM)}`
    // timezone=GMT : les heures renvoyées sont en UTC, sans décalage à gérer
    const url =
      `${ENDPOINT}?latitude=${at.lat}&longitude=${at.lng}&hourly=${HOURLY}&wind_speed_unit=kmh${elevation}` +
      `&timezone=GMT&start_date=${utcDay(new Date(first))}&end_date=${utcDay(new Date(last))}`

    const response = await fetch(url)
    if (!response.ok) throw new Error(`Open-Meteo : HTTP ${response.status} (date hors des 16 jours de prévision ?)`)

    const { hourly } = (await response.json()) as HourlyResponse
    if (!hourly) throw new Error('Open-Meteo : prévisions absentes')

    const hours: HourlyForecast[] = []
    hourly.time.forEach((label, i) => {
      const time = new Date(`${label}Z`)
      if (time.getTime() < first || time.getTime() > last) return
      const apparent = hourly.apparent_temperature[i]
      const gust = hourly.wind_gusts_10m[i]
      if (apparent === null || gust === null) return
      hours.push({
        time,
        apparentTemperature: apparent,
        precipitationMm: hourly.precipitation[i] ?? 0,
        precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
        windGustKmh: gust,
        weatherCode: hourly.weather_code[i] ?? 0,
      })
    })
    return hours
  }
}
