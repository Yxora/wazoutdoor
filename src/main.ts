import { checkDatabase } from './application/checkDatabase'
import { evaluateRoute, type EvaluationDeps } from './application/evaluateRoute'
import { listActiveSignalisations } from './application/listSignalisations'
import { locateUser } from './application/locateUser'
import type { SignalisationStore } from './application/ports'
import { reportSignalisation } from './application/reportSignalisation'
import { PROFILES } from './domain/profile'
import { BrowserGeolocator } from './infra/browserGeolocator'
import { GpxRouteParser } from './infra/gpxRouteParser'
import { IgnElevation } from './infra/ignElevation'
import { LocalSignalisationStore } from './infra/localSignalisationStore'
import { MeteoFranceVigilance } from './infra/meteoFranceVigilance'
import { OpenMeteoDaylight } from './infra/openMeteoDaylight'
import { OpenMeteoForecast } from './infra/openMeteoForecast'
import { RefugesInfoPlaces } from './infra/refugesInfoPlaces'
import { SupabaseHealth } from './infra/supabaseHealth'
import { SupabaseSignalisationStore } from './infra/supabaseSignalisationStore'
import { createMap, createRouteLayers, createSignalisationLayer, showUserPosition } from './ui/map'
import { createPanel } from './ui/panel'
import { createSignalisationControl } from './ui/signalisationControl'
import exampleGpx from './ui/samples/hohneck-exemple.gpx?raw'
import './ui/tokens.css'
import './ui/style.css'
import './ui/signalisation.css'

const deps: EvaluationDeps = {
  elevation: new IgnElevation(),
  daylight: new OpenMeteoDaylight(),
  weather: new MeteoFranceVigilance(import.meta.env.VITE_METEOFRANCE_API_KEY),
  forecast: new OpenMeteoForecast(),
  places: new RefugesInfoPlaces(),
}

const parser = new GpxRouteParser()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Signalements partagés entre tout le monde si Supabase est configuré, sinon stockage local au navigateur.
const signalisationStore: SignalisationStore =
  supabaseUrl && supabaseAnonKey ? new SupabaseSignalisationStore(supabaseUrl, supabaseAnonKey) : new LocalSignalisationStore()

async function checkSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.info('Supabase non configuré (variables VITE_SUPABASE_* absentes) : sans effet sur le score')
    return
  }

  const result = await checkDatabase(new SupabaseHealth(supabaseUrl, supabaseAnonKey))
  if (result.ok) console.log('Supabase OK')
  else console.error(`Supabase KO : ${result.detail}`)
}

function main() {
  const map = createMap(document.getElementById('map')!)
  const layers = createRouteLayers(map)
  let routeShown = false
  const geolocator = new BrowserGeolocator()

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
  locateUser(geolocator).then((location) => {
    if (location.ok && !routeShown) showUserPosition(map, location.position)
    else if (!location.ok) console.info(`Position non disponible (${location.reason}), carte centrée sur les Vosges`)
  })

  const signalisationLayer = createSignalisationLayer(map)
  listActiveSignalisations(signalisationStore)
    .then((signalisations) => signalisationLayer.show(signalisations))
    .catch((error) => console.error(`Signalements indisponibles : ${error instanceof Error ? error.message : error}`))

  createSignalisationControl({
    getCurrentPosition: () => locateUser(geolocator),
    onSubmit: async ({ position, type, description }) => {
      const signalisation = await reportSignalisation(signalisationStore, { position, type, description })
      signalisationLayer.add(signalisation)
    },
  })

  checkSupabase()
}

main()
