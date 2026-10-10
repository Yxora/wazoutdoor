import { describe, expect, it } from 'vitest'
import { listLibraryRoutes } from './listLibraryRoutes'
import type { RouteLibrary } from './ports'

function library(overrides: Partial<RouteLibrary> = {}): RouteLibrary {
  return {
    source: 'Strava',
    isConnected: () => true,
    beginConnection: () => {},
    finishConnection: async () => {},
    disconnect: () => {},
    list: async () => [{ id: '1', name: 'Hohneck', distanceKm: 12.3, ascentM: 640 }],
    gpx: async () => '<gpx/>',
    ...overrides,
  }
}

describe('listLibraryRoutes', () => {
  it('renvoie les itinéraires quand le compte est connecté', async () => {
    const result = await listLibraryRoutes(library())
    expect(result).toEqual({ ok: true, routes: [{ id: '1', name: 'Hohneck', distanceKm: 12.3, ascentM: 640 }] })
  })

  it('ne contacte pas le service quand le compte n’est pas connecté', async () => {
    let called = false
    const result = await listLibraryRoutes(
      library({
        isConnected: () => false,
        list: async () => {
          called = true
          return []
        },
      }),
    )
    expect(called).toBe(false)
    expect(result).toMatchObject({ ok: false, reason: 'not-connected' })
  })

  it('transforme une erreur du service en échec lisible', async () => {
    const result = await listLibraryRoutes(
      library({
        list: async () => {
          throw new Error('Strava a répondu HTTP 429')
        },
      }),
    )
    expect(result).toEqual({ ok: false, reason: 'failed', detail: 'Strava a répondu HTTP 429' })
  })
})
