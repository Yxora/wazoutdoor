import type { Coordinates } from './coordinates'

export interface RoutePoint extends Coordinates {
  ele?: number
}

export interface Route {
  name: string
  points: RoutePoint[]
}

const EARTH_RADIUS_M = 6_371_000

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function routeLengthMeters(points: Coordinates[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i])
  return total
}

export interface SampledPoint extends Coordinates {
  /** Distance parcourue depuis le départ, en mètres */
  atMeters: number
}

/** Points régulièrement espacés le long du tracé, premier et dernier point inclus. */
export function sampleRoute(points: Coordinates[], stepMeters: number): SampledPoint[] {
  if (points.length === 0) return []
  const samples: SampledPoint[] = [{ lat: points[0].lat, lng: points[0].lng, atMeters: 0 }]
  let travelled = 0
  let nextSampleAt = stepMeters

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]
    const to = points[i]
    const segment = distanceMeters(from, to)
    while (segment > 0 && nextSampleAt <= travelled + segment) {
      const ratio = (nextSampleAt - travelled) / segment
      samples.push({
        lat: from.lat + (to.lat - from.lat) * ratio,
        lng: from.lng + (to.lng - from.lng) * ratio,
        atMeters: nextSampleAt,
      })
      nextSampleAt += stepMeters
    }
    travelled += segment
  }

  const last = points[points.length - 1]
  if (samples[samples.length - 1].atMeters < travelled) {
    samples.push({ lat: last.lat, lng: last.lng, atMeters: travelled })
  }
  return samples
}

/** Dénivelé positif cumulé. Les variations sous le seuil sont ignorées pour limiter le bruit. */
export function ascentMeters(elevations: number[], noiseThresholdM = 3): number {
  if (elevations.length === 0) return 0
  let ascent = 0
  let reference = elevations[0]
  for (const elevation of elevations) {
    if (elevation - reference >= noiseThresholdM) {
      ascent += elevation - reference
      reference = elevation
    } else if (reference - elevation >= noiseThresholdM) {
      reference = elevation
    }
  }
  return ascent
}

export interface BoundingBox {
  west: number
  south: number
  east: number
  north: number
}

export function boundingBox(points: Coordinates[], marginDegrees = 0): BoundingBox {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  return {
    west: Math.min(...lngs) - marginDegrees,
    south: Math.min(...lats) - marginDegrees,
    east: Math.max(...lngs) + marginDegrees,
    north: Math.max(...lats) + marginDegrees,
  }
}
