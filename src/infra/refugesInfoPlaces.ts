import type { PlaceProvider } from '../application/ports'
import { kindOfCategory, type Place, type PlaceCategory } from '../domain/place'
import type { BoundingBox } from '../domain/route'

const ENDPOINT = 'https://www.refuges.info/api/bbox'

interface RefugesFeature {
  id: number
  geometry: { coordinates: [number, number] }
  properties: { nom: string; type: { valeur: string }; lien?: string }
}

function categoryOf(typeLabel: string): PlaceCategory | null {
  const label = typeLabel.toLowerCase()
  if (label.includes('eau')) return 'water'
  if (label.includes('cabane')) return 'hut'
  if (label.includes('refuge')) return 'refuge'
  if (label.includes('gîte') || label.includes('gite')) return 'lodge'
  return null
}

export class RefugesInfoPlaces implements PlaceProvider {
  readonly source = 'refuges.info (CC BY-SA 2.0)'

  async around(box: BoundingBox): Promise<Place[]> {
    const bbox = [box.west, box.south, box.east, box.north].map((n) => n.toFixed(5)).join(',')
    const response = await fetch(`${ENDPOINT}?type_points=all&bbox=${bbox}&format=geojson`)
    if (!response.ok) throw new Error(`refuges.info : HTTP ${response.status}`)

    const { features } = (await response.json()) as { features?: RefugesFeature[] }
    if (!features) throw new Error('refuges.info : réponse inattendue')

    return features.flatMap((feature): Place[] => {
      const category = categoryOf(feature.properties.type.valeur)
      if (category === null) return []
      const [lng, lat] = feature.geometry.coordinates
      return [
        {
          id: `refuges-${feature.id}`,
          name: feature.properties.nom,
          kind: kindOfCategory(category),
          category,
          position: { lat, lng },
          source: this.source,
          url: feature.properties.lien,
        },
      ]
    })
  }
}
