import type { Geolocator, LocationResult } from './ports'

export async function locateUser(geolocator: Geolocator): Promise<LocationResult> {
  try {
    return await geolocator.locate()
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}
