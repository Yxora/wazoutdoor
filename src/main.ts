import { checkDatabase } from './application/checkDatabase'
import { applyPreferences, evaluateRoute, type EvaluationDeps } from './application/evaluateRoute'
import {
  commentSignalisation,
  checkNearbySignalisations,
  confirmSignalisationStillThere,
  reportSignalisationGone,
} from './application/maintainSignalisation'
import { listActiveSignalisations } from './application/listSignalisations'
import { locateUser } from './application/locateUser'
import type { AuthGateway, PhotoStore, SignalisationStore } from './application/ports'
import { reportSignalisation } from './application/reportSignalisation'
import { finishSignIn, sendSignInLink, verifyCode } from './application/signIn'
import { updateUser } from './application/updateUser'
import { PROFILES } from './domain/profile'
import { SIGNALISATION_TYPES, type SignalisationPreferences, type SignalisationType } from './domain/signalisation'
import { BrowserGeolocator } from './infra/browserGeolocator'
import { FixedGeolocator, positionFromSearch } from './infra/fixedGeolocator'
import { GpxRouteParser } from './infra/gpxRouteParser'
import { IgnElevation } from './infra/ignElevation'
import { IgnProtectedAreas } from './infra/ignProtectedAreas'
import { LocalAuth } from './infra/localAuth'
import { LocalPhotoStore } from './infra/localPhotoStore'
import { LocalSignalisationStore } from './infra/localSignalisationStore'
import { LocalUserStore } from './infra/localUserStore'
import { MeteoFranceVigilance } from './infra/meteoFranceVigilance'
import { NasaFirmsFireRisk } from './infra/nasaFirmsFireRisk'
import { OpenMeteoDaylight } from './infra/openMeteoDaylight'
import { OpenMeteoForecast } from './infra/openMeteoForecast'
import { RefugesInfoPlaces } from './infra/refugesInfoPlaces'
import { StravaRoutes } from './infra/stravaRoutes'
import { callbackUrl, isSignInReturn, SupabaseAuth } from './infra/supabaseAuth'
import { SupabaseHealth } from './infra/supabaseHealth'
import { SupabasePhotoStore } from './infra/supabasePhotoStore'
import { SupabaseSignalisationStore } from './infra/supabaseSignalisationStore'
import { createMap, createRouteLayers, createSignalisationLayer, showUserPosition } from './ui/map'
import { createBottomNav } from './ui/bottomNav'
import { createImportModal } from './ui/importModal'
import { playScoreEffect } from './ui/scoreEffect'
import { createScoreView, type ResultView } from './ui/scoreView'
import { createSignalisationControl } from './ui/signalisationControl'
import { createSignInForm } from './ui/signInForm'
import { showToast } from './ui/toast'
import { createUserProfile } from './ui/userProfile'
import './ui/tokens.css'
import './ui/style.css'
import './ui/signalisation.css'

const parser = new GpxRouteParser()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Signalements partagés entre tout le monde si Supabase est configuré, sinon stockage local au navigateur.
const signalisationStore: SignalisationStore =
  supabaseUrl && supabaseAnonKey ? new SupabaseSignalisationStore(supabaseUrl, supabaseAnonKey) : new LocalSignalisationStore()

// Photos des signalements : Supabase Storage si configuré, sinon gardées dans le navigateur avec le signalement
const photoStore: PhotoStore = supabaseUrl && supabaseAnonKey ? new SupabasePhotoStore(supabaseUrl, supabaseAnonKey) : new LocalPhotoStore()

const deps: EvaluationDeps = {
  elevation: new IgnElevation(),
  daylight: new OpenMeteoDaylight(),
  weather: new MeteoFranceVigilance(import.meta.env.VITE_METEOFRANCE_API_KEY),
  forecast: new OpenMeteoForecast(),
  places: new RefugesInfoPlaces(),
  fireRisk: new NasaFirmsFireRisk(import.meta.env.VITE_FIRMS_API_KEY),
  protectedAreas: new IgnProtectedAreas(),
  signalisations: signalisationStore,
}

async function checkSupabase() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.info('Supabase non configuré (variables VITE_SUPABASE_* absentes) : sans effet sur le score')
    return
  }

  const result = await checkDatabase(new SupabaseHealth(supabaseUrl, supabaseAnonKey))
  if (result.ok) console.log('Supabase OK')
  else console.error(`Supabase KO : ${result.detail}`)
}

/** Comptes Supabase si configuré ; sinon Julie, toujours connectée, pour la démo hors ligne */
async function createAuth(): Promise<AuthGateway> {
  if (!supabaseUrl || !supabaseAnonKey) return new LocalAuth()
  return SupabaseAuth.create({ url: supabaseUrl, anonKey: supabaseAnonKey, redirectTo: callbackUrl(location.origin + location.pathname) })
}

/**
 * Au retour du lien de connexion (?auth=callback&code=...) : on termine la connexion puis on nettoie l'URL.
 * À faire avant le retour Strava, qui prendrait ce ?code= pour le sien.
 */
async function completeSignInReturn(auth: AuthGateway): Promise<string | null> {
  const url = new URL(location.href)
  if (!isSignInReturn(url)) return null
  history.replaceState(null, '', location.pathname)
  try {
    await finishSignIn(auth, url)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Connexion impossible.'
  }
}

function createStravaLibrary(): StravaRoutes | undefined {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!clientId || !supabaseUrl || !anonKey) {
    console.info('Strava non configuré (VITE_STRAVA_CLIENT_ID et VITE_SUPABASE_* requis) : import d’itinéraires désactivé')
    return undefined
  }
  return new StravaRoutes({
    clientId,
    redirectUri: location.origin + location.pathname,
    tokenEndpoint: `${supabaseUrl}/functions/v1/strava-token`,
    anonKey,
  })
}

/** Au retour de Strava, l'URL contient ?code=...&state=... : on termine la connexion puis on nettoie l'URL */
async function completeStravaReturn(strava: StravaRoutes): Promise<string | null> {
  const params = new URLSearchParams(location.search)
  const code = params.get('code')
  const denied = params.get('error')
  if (!code && !denied) return null

  const state = params.get('state')
  history.replaceState(null, '', location.pathname)
  if (denied || !code) return 'Connexion Strava annulée.'
  try {
    await strava.finishConnection(code, state)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : 'Connexion Strava impossible.'
  }
}

function redFlagTypes(preferences: SignalisationPreferences): Set<SignalisationType> {
  return new Set(SIGNALISATION_TYPES.filter((type) => preferences[type] === 'veto'))
}

async function main() {
  const auth = await createAuth()
  const signInError = await completeSignInReturn(auth)
  if (signInError) showToast(signInError)

  const strava = createStravaLibrary()
  const params = new URLSearchParams(location.search)
  const returnedFromStrava = params.has('code') || params.has('error')
  const stravaError = strava ? await completeStravaReturn(strava) : null

  const map = createMap(document.getElementById('map')!)
  const layers = createRouteLayers(map)
  let routeShown = false
  // Démo : ?pos=48.0,7.1 remplace la position du navigateur
  const demoPosition = positionFromSearch(window.location.search)
  const geolocator = demoPosition ? new FixedGeolocator(demoPosition) : new BrowserGeolocator()

  const userStore = new LocalUserStore()
  let lastView: ResultView | null = null

  const userProfile = createUserProfile(userStore.get(), (changes) => {
    const user = updateUser(auth, userStore, changes)
    importModal.setActivities(user.activities)
    signalisationLayer.setRedFlags(redFlagTypes(user.signalisationPreferences))
    // Le score se recalcule sur les données déjà reçues, sans rappeler les sources
    if (lastView) {
      lastView = { ...lastView, evaluation: applyPreferences(lastView.evaluation, lastView.profile, user.preferences, user.signalisationPreferences) }
      scoreView.show(lastView)
    }
  })
  document.getElementById('panel')!.append(userProfile)

  const scoreView = createScoreView()
  const importModal = createImportModal(
    async ({ profileId, start, gpxText }) => {
      try {
        const route = parser.parse(gpxText)
        const profile = PROFILES[profileId]
        const evaluation = await evaluateRoute(deps, { route, profile, start, preferences: userStore.get().preferences, signalisationPreferences: userStore.get().signalisationPreferences })
        layers.show(route, evaluation.places, evaluation.protectedAreas)
        routeShown = true
        lastView = { routeName: route.name, profile, start, evaluation }
        scoreView.show(lastView)
        playScoreEffect(evaluation.score.total, evaluation.score.vetoedBy !== null, evaluation.score.verdict)
        importModal.setBusy(false)
        importModal.allowClose()
        importModal.close()
        nav.markMap()
      } catch (error) {
        importModal.showError(error instanceof Error ? error.message : 'Une erreur inattendue est survenue.')
      }
    },
    strava,
    userStore.get().activities,
  )
  if (stravaError) importModal.showError(stravaError)

  // La localisation ne doit pas écraser le cadrage d'un tracé déjà affiché
  locateUser(geolocator).then((location) => {
    if (location.ok && !routeShown) showUserPosition(map, location.position)
    else if (!location.ok) console.info(`Position non disponible (${location.reason}), carte centrée sur les Vosges`)
  })

  const signalisationLayer = createSignalisationLayer(map, {
    confirm: (s) => confirmSignalisationStillThere(auth, signalisationStore, s.id),
    reportGone: (s) => reportSignalisationGone(auth, signalisationStore, s.id),
    comment: (s, text) => commentSignalisation(auth, signalisationStore, s.id, text),
  })
  signalisationLayer.setRedFlags(redFlagTypes(userStore.get().signalisationPreferences))
  listActiveSignalisations(signalisationStore)
    .then((signalisations) => signalisationLayer.show(signalisations))
    .catch((error) => console.error(`Signalements indisponibles : ${error instanceof Error ? error.message : error}`))

  const signalisationControl = createSignalisationControl({
    getCurrentPosition: () => locateUser(geolocator),
    findNearby: (position, type) => checkNearbySignalisations(signalisationStore, position, type),
    onExisting: async (existing, { stillThere, comment }) => {
      let updated = stillThere
        ? await confirmSignalisationStillThere(auth, signalisationStore, existing.id)
        : await reportSignalisationGone(auth, signalisationStore, existing.id)
      if (comment) updated = await commentSignalisation(auth, signalisationStore, existing.id, comment)
      signalisationLayer.replace(updated)
      // L'utilisateur·rice vient de répondre : on centre la carte sans rouvrir la bulle
      nav.showMap()
      signalisationLayer.focus(updated, { openPopup: false })
      showToast('Merci, réponse bien prise en compte')
    },
    isSignedIn: () => auth.current() !== null,
    createSignInForm: () =>
      createSignInForm({
        sendLink: (email) => sendSignInLink(auth, email),
        verifyCode: async (email, code) => {
          await verifyCode(auth, email, code)
        },
      }),
    onSubmit: async ({ position, type, description, photo }) => {
      const signalisation = await reportSignalisation(auth, signalisationStore, { position, type, description, photo }, photoStore)
      signalisationLayer.add(signalisation)
      // Après l'envoi : retour sur la carte, centrée sur le nouveau signalement
      nav.showMap()
      signalisationLayer.focus(signalisation)
    },
  })

  const nav = createBottomNav(document.getElementById('panel')!, { onReport: () => {
      scoreView.closeDetail()
      importModal.close()
      signalisationControl.start()
    }, onLeaveReport: () => signalisationControl.close(), onConsult: () => {
      scoreView.closeDetail()
      importModal.close()
    }, onPlan: () => {
      scoreView.closeDetail()
      importModal.toggle()
      return importModal.isOpen()
    } })
  importModal.onClose(() => nav.planClosed())
  // Au retour de Strava, on reprend sur Vérifier pour choisir un itinéraire
  if (returnedFromStrava) {
    importModal.open()
    nav.planOpened()
  }

  // Signaler est l'onglet par défaut : son écran s'ouvre dès l'arrivée (sauf au retour de Strava)
  if (!returnedFromStrava) signalisationControl.start()

  // Connexion par code, par le lien dans un autre onglet, ou session expirée
  auth.onChange(() => signalisationControl.refresh())

  checkSupabase()
}

main()
