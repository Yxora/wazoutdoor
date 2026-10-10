import type { Coordinates } from '../domain/coordinates'
import type { Geolocator, LocationResult } from '../application/ports'

/** Position imposée pour la démo : le navigateur n'est pas interrogé. */
export class FixedGeolocator implements Geolocator {
  constructor(private readonly position: Coordinates) {}

  locate(): Promise<LocationResult> {
    return Promise.resolve({ ok: true, position: this.position })
  }
}

/** Lit `?pos=lat,lng` dans l'URL. Renvoie null si le paramètre est absent ou invalide. */
export function positionFromSearch(search: string): Coordinates | null {
  const raw = new URLSearchParams(search).get('pos')
  if (!raw) return null
  const [lat, lng, ...rest] = raw.split(',').map((part) => Number(part.trim()))
  if (rest.length > 0 || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}
