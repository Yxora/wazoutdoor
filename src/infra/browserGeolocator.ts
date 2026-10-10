import type { Geolocator, LocationResult } from '../application/ports'

export class BrowserGeolocator implements Geolocator {
  locate(): Promise<LocationResult> {
    if (!('geolocation' in navigator)) {
      return Promise.resolve({ ok: false, reason: 'unavailable' })
    }

    // Le navigateur affiche lui-même la demande d'autorisation (HTTPS ou localhost requis)
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ ok: true, position: { lat: coords.latitude, lng: coords.longitude } }),
        (error) =>
          resolve({
            ok: false,
            reason:
              error.code === error.PERMISSION_DENIED
                ? 'denied'
                : error.code === error.TIMEOUT
                  ? 'timeout'
                  : 'unavailable',
          }),
        { enableHighAccuracy: true, timeout: 10_000 },
      )
    })
  }
}
