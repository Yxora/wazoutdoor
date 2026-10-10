import type { Coordinates } from './coordinates'

/** Rôle du lieu dans le score : un point d'eau ou un abri */
export type PlaceKind = 'water' | 'shelter'

/** Nature du lieu, pour l'affichage (icône, légende) */
export type PlaceCategory = 'water' | 'hut' | 'refuge' | 'lodge'

export interface Place {
  id: string
  name: string
  kind: PlaceKind
  category: PlaceCategory
  position: Coordinates
  source: string
  url?: string
}

export const PLACE_CATEGORY_LABEL: Record<PlaceCategory, string> = {
  water: 'Point d’eau',
  hut: 'Cabane non gardée',
  refuge: 'Refuge gardé',
  lodge: 'Gîte d’étape',
}

export function kindOfCategory(category: PlaceCategory): PlaceKind {
  return category === 'water' ? 'water' : 'shelter'
}
