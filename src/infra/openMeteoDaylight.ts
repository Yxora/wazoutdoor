import type { DaylightProvider } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast'

function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export class OpenMeteoDaylight implements DaylightProvider {
  readonly source = 'Open-Meteo (usage non commercial)'

  async sunset(at: Coordinates, day: Date): Promise<Date> {
    const date = localDay(day)
    // timezone=GMT : l'heure renvoyée est en UTC, sans décalage à gérer
    const url = `${ENDPOINT}?latitude=${at.lat}&longitude=${at.lng}&daily=sunset&timezone=GMT&start_date=${date}&end_date=${date}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Open-Meteo : HTTP ${response.status} (date hors des 16 jours de prévision ?)`)

    const body = (await response.json()) as { daily?: { sunset?: string[] } }
    const sunset = body.daily?.sunset?.[0]
    if (!sunset) throw new Error('Open-Meteo : heure du coucher du soleil absente')
    return new Date(`${sunset}Z`)
  }
}
