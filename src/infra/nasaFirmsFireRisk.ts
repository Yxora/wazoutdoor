import type { FireRiskProvider } from '../application/ports'
import type { FireConfidence, FireDetection } from '../domain/fire'
import type { BoundingBox } from '../domain/route'

const AREA_ENDPOINT = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
// MODIS (résolution ~1 km) et VIIRS Suomi NPP (résolution ~375 m, détecte des foyers plus petits)
const SENSORS = ['MODIS_NRT', 'VIIRS_SNPP_NRT'] as const

function normalizeConfidence(raw: string | undefined): FireConfidence {
  if (raw === 'h') return 'high'
  if (raw === 'n') return 'nominal'
  if (raw === 'l') return 'low'
  const n = Number(raw)
  if (Number.isNaN(n)) return 'nominal'
  if (n >= 80) return 'high'
  if (n >= 30) return 'nominal'
  return 'low'
}

function parseAcquiredAt(date: string, time: string): Date {
  const padded = time.padStart(4, '0')
  return new Date(`${date}T${padded.slice(0, 2)}:${padded.slice(2)}:00Z`)
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter((line) => line.length > 0)
  if (lines.length < 2) return []
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]))
  })
}

export class NasaFirmsFireRisk implements FireRiskProvider {
  readonly source = 'NASA FIRMS (MODIS/VIIRS, détections satellite)'

  constructor(
    private readonly apiKey: string | undefined,
    private readonly lookbackDays = 2,
  ) {}

  async around(box: BoundingBox): Promise<FireDetection[]> {
    if (!this.apiKey) throw new Error('clé API NASA FIRMS absente (variable VITE_FIRMS_API_KEY)')
    const area = [box.west, box.south, box.east, box.north].map((n) => n.toFixed(4)).join(',')
    const bySensor = await Promise.all(SENSORS.map((sensor) => this.fetchSensor(sensor, area)))
    return bySensor.flat()
  }

  private async fetchSensor(sensor: string, area: string): Promise<FireDetection[]> {
    const url = `${AREA_ENDPOINT}/${this.apiKey}/${sensor}/${area}/${this.lookbackDays}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`NASA FIRMS (${sensor}) : HTTP ${response.status}`)

    const text = await response.text()
    // Sans détection, FIRMS renvoie juste l'en-tête CSV. Sans en-tête, c'est un message d'erreur (clé invalide, zone trop grande...).
    if (!text.toLowerCase().includes('latitude')) {
      throw new Error(`NASA FIRMS (${sensor}) : ${text.trim().slice(0, 200) || 'réponse vide'}`)
    }

    return parseCsv(text)
      .flatMap((row): FireDetection[] => {
        if (!row.latitude || !row.longitude || !row.acq_date || !row.acq_time) return []
        return [
          {
            position: { lat: Number(row.latitude), lng: Number(row.longitude) },
            acquiredAt: parseAcquiredAt(row.acq_date, row.acq_time),
            confidence: normalizeConfidence(row.confidence),
            frp: Number(row.frp) || 0,
            satellite: row.satellite ?? sensor,
          },
        ]
      })
      // Confiance basse = taux de faux positifs élevé (reflets, pixels de bord...), on l'exclut du risque.
      .filter((detection) => detection.confidence !== 'low')
  }
}
