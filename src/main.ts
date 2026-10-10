import { checkDatabase } from './application/checkDatabase'
import { evaluateRoute, type EvaluationDeps } from './application/evaluateRoute'
import { locateUser } from './application/locateUser'
import { PROFILES } from './domain/profile'
import { BrowserGeolocator } from './infra/browserGeolocator'
import { GpxRouteParser } from './infra/gpxRouteParser'
import { IgnElevation } from './infra/ignElevation'
import { MeteoFranceVigilance } from './infra/meteoFranceVigilance'
import { OpenMeteoDaylight } from './infra/openMeteoDaylight'
import { OpenMeteoForecast } from './infra/openMeteoForecast'
import { RefugesInfoPlaces } from './infra/refugesInfoPlaces'
import { SupabaseHealth } from './infra/supabaseHealth'
import { createMap, createRouteLayers, showUserPosition } from './ui/map'
import { createPanel } from './ui/panel'
import exampleGpx from './ui/samples/hohneck-exemple.gpx?raw'
import './ui/style.css'

const deps: EvaluationDeps = {
  elevation: new IgnElevation(),
  daylight: new OpenMeteoDaylight(),
  weather: new MeteoFranceVigilance(import.meta.env.VITE_METEOFRANCE_API_KEY),
  forecast: new OpenMeteoForecast(),
  places: new RefugesInfoPlaces(),
}

const parser = new GpxRouteParser()

async function checkSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.info('Supabase non configuré (variables VITE_SUPABASE_* absentes) : sans effet sur le score')
    return
  }

  const result = await checkDatabase(new SupabaseHealth(url, anonKey))
  if (result.ok) console.log('Supabase OK')
  else console.error(`Supabase KO : ${result.detail}`)
}

function main() {
  const map = createMap(document.getElementById('map')!)
  const layers = createRouteLayers(map)
  let routeShown = false

  const panel = createPanel(
    document.getElementById('panel')!,
    { label: 'exemple Schlucht, Hohneck (aller-retour)', gpx: exampleGpx },
    async ({ profileId, start, gpxText }) => {
      panel.showLoading()
      try {
        const route = parser.parse(gpxText)
        const profile = PROFILES[profileId]
        const evaluation = await evaluateRoute(deps, { route, profile, start })
        layers.show(route, evaluation.places)
        routeShown = true
        panel.showResult({ routeName: route.name, profile, start, evaluation })
      } catch (error) {
        panel.showError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.')
      }
    },
  )

  // La localisation ne doit pas écraser le cadrage d'un tracé déjà affiché
  locateUser(new BrowserGeolocator()).then((location) => {
    if (location.ok && !routeShown) showUserPosition(map, location.position)
    else if (!location.ok) console.info(`Position non disponible (${location.reason}), carte centrée sur les Vosges`)
  })

  checkSupabase()
}

main()
