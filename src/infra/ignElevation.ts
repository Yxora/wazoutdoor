import type { ElevationProvider } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'

const ENDPOINT = 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json'
const MAX_POINTS_PER_REQUEST = 100
const NO_DATA_BELOW = -9000

export class IgnElevation implements ElevationProvider {
  readonly source = 'IGN Géoplateforme (altimétrie)'

  async elevations(points: Coordinates[]): Promise<number[]> {
    const result: number[] = []
    for (let i = 0; i < points.length; i += MAX_POINTS_PER_REQUEST) {
      result.push(...(await this.fetchChunk(points.slice(i, i + MAX_POINTS_PER_REQUEST))))
    }
    return result
  }

  private async fetchChunk(points: Coordinates[]): Promise<number[]> {
    const lon = points.map((p) => p.lng.toFixed(5)).join('%7C')
    const lat = points.map((p) => p.lat.toFixed(5)).join('%7C')
    const response = await fetch(`${ENDPOINT}?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld&zonly=true`)
    if (!response.ok) throw new Error(`IGN altimétrie : HTTP ${response.status}`)

    const body = (await response.json()) as { elevations?: number[] }
    if (!body.elevations || body.elevations.length !== points.length) {
      throw new Error('IGN altimétrie : réponse inattendue')
    }
    if (body.elevations.some((z) => z < NO_DATA_BELOW)) {
      throw new Error('IGN altimétrie : altitude absente pour une partie du tracé')
    }
    return body.elevations
  }
}
