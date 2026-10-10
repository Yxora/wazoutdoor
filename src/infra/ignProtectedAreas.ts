import type { ProtectedAreaProvider } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'
import type { ProtectedArea } from '../domain/protectedArea'
import type { BoundingBox } from '../domain/route'

const ENDPOINT = 'https://data.geopf.fr/wfs/ows'

/**
 * Catalogue INPN/Patrinat exposé par la Géoplateforme (33 couches au total). On ne garde que les
 * zonages qui imposent une vraie contrainte de comportement au randonneur·se (sentiers, périodes de
 * quiétude...), pas les inventaires scientifiques (ZNIEFF) ni Natura 2000 (SIC/ZPS, trop étendu dans
 * les Vosges pour rester un signal utile) ni les zonages purement maritimes ou labels UNESCO.
 */
const LAYERS: { typeName: string; category: string }[] = [
  { typeName: 'patrinat_pn2:pn', category: 'Parc national (cœur)' },
  { typeName: 'patrinat_rnn:rnn', category: 'Réserve naturelle nationale' },
  { typeName: 'patrinat_rnr:rnr', category: 'Réserve naturelle régionale' },
  { typeName: 'patrinat_apb:apb', category: 'Arrêté de protection de biotope' },
  { typeName: 'patrinat_aphn:aphn', category: 'Arrêté de protection du patrimoine naturel' },
]

interface GeoJsonFeature {
  properties: { nom_site?: string; url_fiche?: string; gest_site?: string }
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown }
}

function ring(coordinates: number[][]): Coordinates[] {
  return coordinates.map(([lng, lat]) => ({ lat, lng }))
}

function polygonsOf(geometry: GeoJsonFeature['geometry']): Coordinates[][][] {
  if (geometry.type === 'Polygon') return [(geometry.coordinates as number[][][]).map(ring)]
  return (geometry.coordinates as number[][][][]).map((polygon) => polygon.map(ring))
}

export class IgnProtectedAreas implements ProtectedAreaProvider {
  readonly source = 'IGN Géoplateforme (zones protégées, INPN/Patrinat)'

  async around(box: BoundingBox): Promise<ProtectedArea[]> {
    const byLayer = await Promise.all(LAYERS.map((layer) => this.fetchLayer(layer, box)))
    return byLayer.flat()
  }

  private async fetchLayer(layer: { typeName: string; category: string }, box: BoundingBox): Promise<ProtectedArea[]> {
    const bbox = `${box.west},${box.south},${box.east},${box.north},EPSG:4326`
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: layer.typeName,
      BBOX: bbox,
      SRSNAME: 'EPSG:4326',
      OUTPUTFORMAT: 'application/json',
    })
    const response = await fetch(`${ENDPOINT}?${params.toString()}`)
    if (!response.ok) throw new Error(`IGN Géoplateforme (${layer.typeName}) : HTTP ${response.status}`)

    const body = (await response.json()) as { features?: GeoJsonFeature[] }
    if (!body.features) throw new Error(`IGN Géoplateforme (${layer.typeName}) : réponse inattendue`)

    return body.features.map((feature): ProtectedArea => ({
      name: feature.properties.nom_site ?? layer.category,
      category: layer.category,
      url: feature.properties.url_fiche ?? undefined,
      manager: feature.properties.gest_site ?? undefined,
      polygons: polygonsOf(feature.geometry),
    }))
  }
}
