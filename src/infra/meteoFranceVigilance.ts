import type { WeatherAlert, WeatherAlertProvider } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'

const VIGILANCE_URL = 'https://public-api.meteofrance.fr/public/DPVigilance/v1/cartevigilance/encours'
const DEPARTMENT_URL = 'https://geo.api.gouv.fr/communes'

interface VigilanceProduct {
  product: {
    update_time: string
    periods: {
      echeance: string
      timelaps: { domain_ids: { domain_id: string; max_color_id: number }[] }
    }[]
  }
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/** J pour aujourd'hui, J1 pour demain. La carte de vigilance ne couvre pas plus loin. */
function echeanceFor(day: Date, now: Date): 'J' | 'J1' {
  const offset = Math.round((startOfLocalDay(day) - startOfLocalDay(now)) / 86_400_000)
  if (offset === 0) return 'J'
  if (offset === 1) return 'J1'
  throw new Error('la vigilance météo n’est disponible que pour aujourd’hui et demain')
}

export class MeteoFranceVigilance implements WeatherAlertProvider {
  readonly source = 'Météo-France, Bulletin Vigilance'

  constructor(
    private readonly apiKey: string | undefined,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async highestLevel(at: Coordinates, day: Date): Promise<WeatherAlert> {
    if (!this.apiKey) throw new Error('clé API Météo-France absente (variable VITE_METEOFRANCE_API_KEY)')
    const echeance = echeanceFor(day, this.now())
    const department = await this.department(at)

    const response = await fetch(VIGILANCE_URL, { headers: { apikey: this.apiKey } })
    if (response.status === 401 || response.status === 403) {
      throw new Error(`clé API Météo-France refusée ou expirée (HTTP ${response.status})`)
    }
    if (!response.ok) throw new Error(`Météo-France : HTTP ${response.status}`)

    const { product } = (await response.json()) as VigilanceProduct
    const domain = product.periods
      .find((period) => period.echeance === echeance)
      ?.timelaps.domain_ids.find((d) => d.domain_id === department)
    if (!domain) throw new Error(`pas de vigilance trouvée pour le département ${department}`)

    return { level: domain.max_color_id, department, updatedAt: new Date(product.update_time) }
  }

  private async department(at: Coordinates): Promise<string> {
    const response = await fetch(`${DEPARTMENT_URL}?lat=${at.lat}&lon=${at.lng}&fields=departement&format=json`)
    if (!response.ok) throw new Error(`geo.api.gouv.fr : HTTP ${response.status}`)
    const communes = (await response.json()) as { departement?: { code: string } }[]
    const code = communes[0]?.departement?.code
    if (!code) throw new Error('position hors de France métropolitaine')
    return code
  }
}
