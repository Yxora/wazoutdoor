import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { evaluateRoute } from './application/evaluateRoute'
import { PROFILES } from './domain/profile'
import { GpxRouteParser } from './infra/gpxRouteParser'
import { IgnElevation } from './infra/ignElevation'
import { IgnProtectedAreas } from './infra/ignProtectedAreas'
import { MeteoFranceVigilance } from './infra/meteoFranceVigilance'
import { NasaFirmsFireRisk } from './infra/nasaFirmsFireRisk'
import { OpenMeteoDaylight } from './infra/openMeteoDaylight'
import { OpenMeteoForecast } from './infra/openMeteoForecast'
import { RefugesInfoPlaces } from './infra/refugesInfoPlaces'

// Appels réels aux API publiques. Lancer avec : RUN_LIVE=1 npm test
// Clé Météo-France facultative : METEOFRANCE_KEY=... (sinon ce critère est « indisponible »)
// Clé NASA FIRMS facultative : FIRMS_KEY=... (sinon ce critère est « indisponible »)
describe.skipIf(!process.env.RUN_LIVE)('chaîne complète sur des données réelles', () => {
  it('évalue le tracé d’exemple des Vosges', async () => {
    const gpx = readFileSync('src/ui/samples/hohneck-exemple.gpx', 'utf8')
    const route = new GpxRouteParser().parse(gpx)
    const start = new Date()
    start.setHours(start.getHours() + 1)

    const evaluation = await evaluateRoute(
      {
        elevation: new IgnElevation(),
        daylight: new OpenMeteoDaylight(),
        weather: new MeteoFranceVigilance(process.env.METEOFRANCE_KEY),
        forecast: new OpenMeteoForecast(),
        places: new RefugesInfoPlaces(),
        fireRisk: new NasaFirmsFireRisk(process.env.FIRMS_KEY),
        protectedAreas: new IgnProtectedAreas(),
      },
      { route, profile: PROFILES.randonneur, start },
    )

    console.log(JSON.stringify({ summary: evaluation.summary, places: evaluation.places.length }, null, 1))
    for (const c of evaluation.score.criteria) {
      console.log(`${c.id} | ${c.status} | ${c.score} | ${c.detail}`)
      for (const f of c.facets ?? []) console.log(`    ${f.label} | ${f.status} | ${f.detail}`)
    }
    console.log('total', evaluation.score.total, evaluation.score.verdict)

    expect(evaluation.summary.ascentM).not.toBeNull()
    expect(evaluation.places.length).toBeGreaterThan(0)
    const known = evaluation.score.criteria.filter((c) => c.status !== 'unknown')
    expect(known.length).toBeGreaterThanOrEqual(3)
  }, 60_000)
})
