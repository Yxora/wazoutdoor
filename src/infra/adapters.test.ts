import { afterEach, describe, expect, it, vi } from 'vitest'
import { IgnElevation } from './ignElevation'
import { IgnProtectedAreas } from './ignProtectedAreas'
import { MeteoFranceVigilance } from './meteoFranceVigilance'
import { NasaFirmsFireRisk } from './nasaFirmsFireRisk'
import { OpenMeteoDaylight } from './openMeteoDaylight'
import { OpenMeteoForecast } from './openMeteoForecast'
import { RefugesInfoPlaces } from './refugesInfoPlaces'
import { SupabaseSignalisationStore } from './supabaseSignalisationStore'

function stubFetch(routes: Record<string, unknown>, status = 200) {
  const calls: { url: string; headers?: HeadersInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, headers: init?.headers })
      const key = Object.keys(routes).find((k) => url.includes(k))
      if (!key) return new Response('not found', { status: 404 })
      return new Response(JSON.stringify(routes[key]), { status })
    }),
  )
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('OpenMeteoDaylight', () => {
  it('lit l’heure du coucher du soleil en UTC', async () => {
    stubFetch({ 'open-meteo': { daily: { sunset: ['2026-10-11T16:51'] } } })
    const sunset = await new OpenMeteoDaylight().sunset({ lat: 48.04, lng: 7.02 }, new Date(2026, 9, 11, 9))
    expect(sunset.toISOString()).toBe('2026-10-11T16:51:00.000Z')
  })

  it('signale une réponse sans donnée', async () => {
    stubFetch({ 'open-meteo': { daily: {} } })
    await expect(new OpenMeteoDaylight().sunset({ lat: 48, lng: 7 }, new Date())).rejects.toThrow(/absente/)
  })
})

describe('OpenMeteoForecast', () => {
  const hours = ['2026-10-11T08:00', '2026-10-11T09:00', '2026-10-11T10:00', '2026-10-11T11:00', '2026-10-11T12:00']
  const body = {
    hourly: {
      time: hours,
      apparent_temperature: [1, 2, 3, 4, 5],
      precipitation: [0, 0.5, 1, 0, 0],
      precipitation_probability: [10, 20, 30, 40, 50],
      wind_gusts_10m: [30, 40, 50, 60, 70],
      weather_code: [1, 2, 3, 61, 95],
    },
  }

  it('garde les heures entières couvrant la sortie, en UTC', async () => {
    const calls = stubFetch({ 'open-meteo': body })
    // 09:20 -> 10:40 : doit couvrir 09:00, 10:00 et 11:00
    const result = await new OpenMeteoForecast().hourly(
      { lat: 48.04, lng: 7.02 },
      new Date('2026-10-11T09:20:00Z'),
      new Date('2026-10-11T10:40:00Z'),
      1234.6,
    )
    expect(result.map((h) => h.time.toISOString())).toEqual([
      '2026-10-11T09:00:00.000Z',
      '2026-10-11T10:00:00.000Z',
      '2026-10-11T11:00:00.000Z',
    ])
    expect(result[1]).toMatchObject({ apparentTemperature: 3, precipitationMm: 1, windGustKmh: 50, weatherCode: 3 })
    expect(calls[0].url).toContain('elevation=1235')
    expect(calls[0].url).toContain('start_date=2026-10-11&end_date=2026-10-11')
  })

  it('n’envoie pas d’altitude quand elle est inconnue', async () => {
    const calls = stubFetch({ 'open-meteo': body })
    await new OpenMeteoForecast().hourly({ lat: 48, lng: 7 }, new Date('2026-10-11T09:00:00Z'), new Date('2026-10-11T10:00:00Z'), null)
    expect(calls[0].url).not.toContain('elevation=')
  })

  it('demande deux jours quand la sortie passe minuit UTC', async () => {
    const calls = stubFetch({ 'open-meteo': body })
    await new OpenMeteoForecast().hourly({ lat: 48, lng: 7 }, new Date('2026-10-11T23:00:00Z'), new Date('2026-10-12T01:00:00Z'), null)
    expect(calls[0].url).toContain('start_date=2026-10-11&end_date=2026-10-12')
  })

  it('ignore les heures sans mesure et accepte l’absence de probabilité', async () => {
    stubFetch({
      'open-meteo': {
        hourly: {
          time: ['2026-10-11T09:00', '2026-10-11T10:00'],
          apparent_temperature: [null, 3],
          precipitation: [0, 0],
          wind_gusts_10m: [10, 20],
          weather_code: [0, 0],
        },
      },
    })
    const result = await new OpenMeteoForecast().hourly(
      { lat: 48, lng: 7 },
      new Date('2026-10-11T09:00:00Z'),
      new Date('2026-10-11T10:00:00Z'),
      null,
    )
    expect(result).toHaveLength(1)
    expect(result[0].precipitationProbability).toBeNull()
  })

  it('signale une date hors prévision', async () => {
    stubFetch({ 'open-meteo': {} }, 400)
    await expect(
      new OpenMeteoForecast().hourly({ lat: 48, lng: 7 }, new Date(), new Date(), null),
    ).rejects.toThrow(/16 jours/)
  })
})

describe('IgnElevation', () => {
  it('renvoie les altitudes dans l’ordre des points', async () => {
    const calls = stubFetch({ geopf: { elevations: [1100, 1200] } })
    const result = await new IgnElevation().elevations([
      { lat: 48, lng: 7 },
      { lat: 48.1, lng: 7.1 },
    ])
    expect(result).toEqual([1100, 1200])
    expect(calls[0].url).toContain('lon=7.00000%7C7.10000')
  })

  it('refuse une altitude manquante (-99999)', async () => {
    stubFetch({ geopf: { elevations: [-99999] } })
    await expect(new IgnElevation().elevations([{ lat: 48, lng: 7 }])).rejects.toThrow(/absente/)
  })
})

describe('RefugesInfoPlaces', () => {
  it('classe les points en eau ou abri et ignore le reste', async () => {
    stubFetch({
      refuges: {
        features: [
          { id: 1, geometry: { coordinates: [7.0, 48.0] }, properties: { nom: 'Source', type: { valeur: 'point d\'eau' } } },
          { id: 2, geometry: { coordinates: [7.1, 48.1] }, properties: { nom: 'Abri', type: { valeur: 'cabane non gardée' } } },
          { id: 3, geometry: { coordinates: [7.2, 48.2] }, properties: { nom: 'Auberge', type: { valeur: 'gîte d\'étape' } } },
          { id: 4, geometry: { coordinates: [7.3, 48.3] }, properties: { nom: 'Pas', type: { valeur: 'passage délicat' } } },
          { id: 5, geometry: { coordinates: [7.4, 48.4] }, properties: { nom: 'Refuge du Sommet', type: { valeur: 'refuge gardé' } } },
        ],
      },
    })
    const places = await new RefugesInfoPlaces().around({ west: 6.9, south: 47.9, east: 7.4, north: 48.4 })
    expect(places.map((p) => [p.name, p.kind, p.category])).toEqual([
      ['Source', 'water', 'water'],
      ['Abri', 'shelter', 'hut'],
      ['Auberge', 'shelter', 'lodge'],
      ['Refuge du Sommet', 'shelter', 'refuge'],
    ])
    expect(places[0].position).toEqual({ lat: 48.0, lng: 7.0 })
  })
})

describe('NasaFirmsFireRisk', () => {
  const box = { west: 6.9, south: 47.9, east: 7.4, north: 48.4 }
  const modisCsv =
    'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,confidence,version,bright_t31,frp,daynight\n' +
    '48.05,7.02,310.5,1.0,1.0,2026-10-10,1320,Terra,78,6.03,290.1,15.2,D'
  const viirsCsv =
    'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight\n' +
    '48.06,7.03,330.2,0.4,0.4,2026-10-10,1325,N,VIIRS,h,2.0NRT,295.3,5.4,D\n' +
    '48.07,7.04,310.0,0.4,0.4,2026-10-10,1325,N,VIIRS,l,2.0NRT,290.0,2.1,D'

  function stubFirms(bodies: { modis?: string; viirs?: string }, status = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/MODIS_NRT/')) return new Response(bodies.modis ?? '', { status })
        if (url.includes('/VIIRS_SNPP_NRT/')) return new Response(bodies.viirs ?? '', { status })
        return new Response('not found', { status: 404 })
      }),
    )
  }

  it('fusionne MODIS et VIIRS et écarte les détections à confiance basse', async () => {
    stubFirms({ modis: modisCsv, viirs: viirsCsv })
    const detections = await new NasaFirmsFireRisk('clé').around(box)
    expect(detections).toHaveLength(2)
    expect(detections.map((d) => d.confidence)).toEqual(['nominal', 'high'])
    expect(detections[1].position).toEqual({ lat: 48.06, lng: 7.03 })
    expect(detections[1].acquiredAt.toISOString()).toBe('2026-10-10T13:25:00.000Z')
  })

  it('refuse l’absence de clé', async () => {
    stubFirms({ modis: modisCsv, viirs: viirsCsv })
    await expect(new NasaFirmsFireRisk(undefined).around(box)).rejects.toThrow(/clé API NASA FIRMS absente/)
  })

  it('signale une clé refusée (réponse sans en-tête CSV)', async () => {
    stubFirms({ modis: 'Invalid MAP_KEY', viirs: viirsCsv })
    await expect(new NasaFirmsFireRisk('mauvaise-clé').around(box)).rejects.toThrow(/Invalid MAP_KEY/)
  })

  it('n’a aucune détection quand seul l’en-tête est renvoyé', async () => {
    const header = modisCsv.split('\n')[0]
    stubFirms({ modis: header, viirs: header })
    const detections = await new NasaFirmsFireRisk('clé').around(box)
    expect(detections).toEqual([])
  })
})

describe('IgnProtectedAreas', () => {
  const box = { west: 6.9, south: 47.9, east: 7.4, north: 48.4 }

  function stubWfs(featuresByLayer: Record<string, unknown[]>, status = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const key = Object.keys(featuresByLayer).find((k) => url.includes(k))
        if (!key) return new Response(JSON.stringify({ features: [] }), { status: 200 })
        return new Response(JSON.stringify({ features: featuresByLayer[key] }), { status })
      }),
    )
  }

  it('convertit une entité GeoJSON Polygon en zone protégée', async () => {
    stubWfs({
      patrinat_rnn: [
        {
          properties: {
            nom_site: 'Massif Du Ventron',
            url_fiche: 'https://inpn.mnhn.fr/espace/protege/FR3600095',
            gest_site: 'PNR Ballons des Vosges',
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [7.0, 48.0],
                [7.1, 48.0],
                [7.1, 48.1],
                [7.0, 48.1],
                [7.0, 48.0],
              ],
            ],
          },
        },
      ],
    })
    const areas = await new IgnProtectedAreas().around(box)
    expect(areas).toHaveLength(1)
    expect(areas[0]).toMatchObject({
      name: 'Massif Du Ventron',
      category: 'Réserve naturelle nationale',
      url: 'https://inpn.mnhn.fr/espace/protege/FR3600095',
      manager: 'PNR Ballons des Vosges',
    })
    expect(areas[0].polygons[0][0][0]).toEqual({ lat: 48.0, lng: 7.0 })
  })

  it('convertit une géométrie MultiPolygon et retombe sur la catégorie sans nom de site', async () => {
    stubWfs({
      patrinat_apb: [
        {
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [[[[7.0, 48.0], [7.1, 48.0], [7.1, 48.1], [7.0, 48.0]]]],
          },
        },
      ],
    })
    const areas = await new IgnProtectedAreas().around(box)
    const apb = areas.find((a) => a.category === 'Arrêté de protection de biotope')
    expect(apb?.name).toBe('Arrêté de protection de biotope')
    expect(apb?.polygons).toHaveLength(1)
  })

  it('signale un échec HTTP sur une des couches interrogées', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('patrinat_rnn') ? new Response('', { status: 500 }) : new Response(JSON.stringify({ features: [] })),
      ),
    )
    await expect(new IgnProtectedAreas().around(box)).rejects.toThrow(/HTTP 500/)
  })
})

describe('SupabaseSignalisationStore', () => {
  const row = {
    id: 'a1',
    type: 'arbre',
    description: 'Travers le chemin',
    lat: 48.05,
    lng: 7.02,
    created_at: '2026-10-10T08:30:00.000Z',
  }

  it('envoie le signalement au format de la table, avec la clé publique', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init })
        return new Response(null, { status: 201 })
      }),
    )

    const store = new SupabaseSignalisationStore('https://example.supabase.co/', 'anon-key')
    await store.save({
      id: 'a1',
      type: 'arbre',
      description: 'Travers le chemin',
      position: { lat: 48.05, lng: 7.02 },
      createdAt: new Date('2026-10-10T08:30:00.000Z'),
    })

    expect(calls[0].url).toBe('https://example.supabase.co/rest/v1/signalisations')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls[0].init?.headers).toMatchObject({ apikey: 'anon-key', Authorization: 'Bearer anon-key' })
    expect(JSON.parse(calls[0].init?.body as string)).toEqual(row)
  })

  it('signale un échec HTTP à la sauvegarde', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    )
    const store = new SupabaseSignalisationStore('https://example.supabase.co', 'anon-key')
    await expect(
      store.save({ id: 'a1', type: 'arbre', description: '', position: { lat: 48, lng: 7 }, createdAt: new Date() }),
    ).rejects.toThrow(/HTTP 401/)
  })

  it('relit les signalements et reconstruit la position et la date', async () => {
    const calls = stubFetch({ 'rest/v1/signalisations': [row] })
    const store = new SupabaseSignalisationStore('https://example.supabase.co', 'anon-key')
    const result = await store.list()

    expect(result).toEqual([
      {
        id: 'a1',
        type: 'arbre',
        description: 'Travers le chemin',
        position: { lat: 48.05, lng: 7.02 },
        createdAt: new Date('2026-10-10T08:30:00.000Z'),
      },
    ])
    expect(calls[0].url).toContain('order=created_at.desc')
  })
})

describe('MeteoFranceVigilance', () => {
  const now = new Date(2026, 9, 10, 12)
  const vigilance = {
    product: {
      update_time: '2026-10-10T04:00:08Z',
      periods: [
        { echeance: 'J', timelaps: { domain_ids: [{ domain_id: '88', max_color_id: 2 }] } },
        { echeance: 'J1', timelaps: { domain_ids: [{ domain_id: '88', max_color_id: 3 }] } },
      ],
    },
  }
  const routes = {
    'geo.api.gouv.fr': [{ departement: { code: '88' } }],
    meteofrance: vigilance,
  }

  it('lit le niveau du jour et du lendemain pour le département', async () => {
    const calls = stubFetch(routes)
    const provider = new MeteoFranceVigilance('clé', () => now)
    const today = await provider.highestLevel({ lat: 48, lng: 7 }, new Date(2026, 9, 10, 8))
    const tomorrow = await provider.highestLevel({ lat: 48, lng: 7 }, new Date(2026, 9, 11, 8))
    expect(today).toMatchObject({ level: 2, department: '88' })
    expect(tomorrow.level).toBe(3)
    const vigilanceCall = calls.find((c) => c.url.includes('meteofrance'))
    expect(vigilanceCall?.headers).toEqual({ apikey: 'clé' })
  })

  it('explique l’absence de clé', async () => {
    stubFetch(routes)
    await expect(new MeteoFranceVigilance(undefined, () => now).highestLevel({ lat: 48, lng: 7 }, now)).rejects.toThrow(
      /clé API Météo-France absente/,
    )
  })

  it('refuse les dates au-delà de demain', async () => {
    stubFetch(routes)
    const provider = new MeteoFranceVigilance('clé', () => now)
    await expect(provider.highestLevel({ lat: 48, lng: 7 }, new Date(2026, 9, 14, 8))).rejects.toThrow(/aujourd’hui et demain/)
  })

  it('signale une clé refusée ou expirée', async () => {
    stubFetch({ 'geo.api.gouv.fr': [{ departement: { code: '88' } }], meteofrance: {} }, 200)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('geo.api.gouv.fr')
          ? new Response(JSON.stringify([{ departement: { code: '88' } }]))
          : new Response('', { status: 401 }),
      ),
    )
    await expect(new MeteoFranceVigilance('périmée', () => now).highestLevel({ lat: 48, lng: 7 }, now)).rejects.toThrow(
      /refusée ou expirée/,
    )
  })
})
