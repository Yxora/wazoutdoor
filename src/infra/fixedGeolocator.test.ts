import { describe, expect, it } from 'vitest'
import { FixedGeolocator, positionFromSearch } from './fixedGeolocator'

describe('positionFromSearch', () => {
  it('lit latitude et longitude', () => {
    expect(positionFromSearch('?pos=48.0,7.1')).toEqual({ lat: 48, lng: 7.1 })
  })

  it('accepte les valeurs négatives et les espaces', () => {
    expect(positionFromSearch('?pos=-33.9, 18.4')).toEqual({ lat: -33.9, lng: 18.4 })
  })

  it.each(['', '?pos=', '?pos=48', '?pos=a,b', '?pos=48,7,1', '?pos=95,7', '?pos=48,200'])('ignore %j', (search) => {
    expect(positionFromSearch(search)).toBeNull()
  })
})

describe('FixedGeolocator', () => {
  it('renvoie la position imposée', async () => {
    const result = await new FixedGeolocator({ lat: 48, lng: 7 }).locate()
    expect(result).toEqual({ ok: true, position: { lat: 48, lng: 7 } })
  })
})
