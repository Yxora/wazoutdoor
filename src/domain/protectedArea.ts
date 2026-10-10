import type { Coordinates } from './coordinates'

/** Zone protégée (réserve naturelle, arrêté de biotope, parc national...) */
export interface ProtectedArea {
  name: string
  /** Catégorie de protection, par ex. « Réserve naturelle nationale » */
  category: string
  url?: string
  manager?: string
  /** Un polygone par élément du tableau (gère les multi-polygones), chaque polygone étant [anneau extérieur, trous...] */
  polygons: Coordinates[][][]
}

function isInRing(point: Coordinates, ring: Coordinates[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    const crosses =
      a.lat !== b.lat &&
      point.lat >= Math.min(a.lat, b.lat) &&
      point.lat < Math.max(a.lat, b.lat) &&
      point.lng < ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
    if (crosses) inside = !inside
  }
  return inside
}

/** Point dans un polygone (ray casting), un trou éventuel exclut la zone qu'il découpe */
function isInPolygon(point: Coordinates, rings: Coordinates[][]): boolean {
  const [outer, ...holes] = rings
  if (!outer || !isInRing(point, outer)) return false
  return holes.every((hole) => !isInRing(point, hole))
}

export function isPointInProtectedArea(point: Coordinates, area: ProtectedArea): boolean {
  return area.polygons.some((rings) => isInPolygon(point, rings))
}
