import type { Coordinates } from '../domain/coordinates'
import type { FireDetection } from '../domain/fire'
import type { HourlyForecast } from '../domain/forecast'
import type { Place } from '../domain/place'
import type { ProtectedArea } from '../domain/protectedArea'
import type { BoundingBox, Route } from '../domain/route'
import type { Signalisation } from '../domain/signalisation'
import type { User } from '../domain/user'

export type LocationResult =
  | { ok: true; position: Coordinates }
  | { ok: false; reason: 'denied' | 'unavailable' | 'timeout' }

export interface Geolocator {
  locate(): Promise<LocationResult>
}

export interface HealthResult {
  ok: boolean
  detail: string
}

export interface DatabaseHealth {
  check(): Promise<HealthResult>
}

export interface RouteParser {
  /** Lève une erreur lisible si le contenu n'est pas un tracé exploitable */
  parse(text: string): Route
}

export interface ElevationProvider {
  readonly source: string
  elevations(points: Coordinates[]): Promise<number[]>
}

export interface DaylightProvider {
  readonly source: string
  sunset(at: Coordinates, day: Date): Promise<Date>
}

export interface WeatherAlert {
  /** Niveau de vigilance le plus élevé, de 1 (vert) à 4 (rouge) */
  level: number
  department: string
  updatedAt: Date
}

export interface WeatherAlertProvider {
  readonly source: string
  highestLevel(at: Coordinates, day: Date): Promise<WeatherAlert>
}

export interface ForecastProvider {
  readonly source: string
  /** Prévisions horaires couvrant la période, corrigées de l'altitude quand elle est connue */
  hourly(at: Coordinates, from: Date, to: Date, altitudeM: number | null): Promise<HourlyForecast[]>
}

export interface PlaceProvider {
  readonly source: string
  around(box: BoundingBox): Promise<Place[]>
}

export interface FireRiskProvider {
  readonly source: string
  /** Détections actives (MODIS/VIIRS) dans la zone, sur les derniers jours */
  around(box: BoundingBox): Promise<FireDetection[]>
}

export interface ProtectedAreaProvider {
  readonly source: string
  around(box: BoundingBox): Promise<ProtectedArea[]>
}

export interface SignalisationStore {
  save(signalisation: Signalisation): Promise<void>
  list(): Promise<Signalisation[]>
}

export interface RouteSummary {
  id: string
  name: string
  distanceKm: number
  ascentM: number | null
}

/** Bibliothèque d'itinéraires d'un compte externe (Strava), accessible après connexion de l'utilisateur·rice */
export interface RouteLibrary {
  readonly source: string
  isConnected(): boolean
  /** Redirige vers la page d'autorisation du service */
  beginConnection(): void
  /** Termine la connexion au retour de la redirection, avec le code et l'état reçus dans l'URL */
  finishConnection(code: string, state: string | null): Promise<void>
  disconnect(): void
  list(): Promise<RouteSummary[]>
  gpx(id: string): Promise<string>
}

export interface UserStore {
  get(): User
  save(user: User): void
}
