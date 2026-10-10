import type { RouteLibrary, RouteSummary } from '../application/ports'

const API = 'https://www.strava.com/api/v3'
const AUTHORIZE = 'https://www.strava.com/oauth/authorize'
const SESSION_KEY = 'wazoutdoor.strava'
const STATE_KEY = 'wazoutdoor.strava.state'

interface Session {
  accessToken: string
  refreshToken: string
  /** Secondes depuis 1970, comme dans la réponse de Strava */
  expiresAt: number
  athleteId: number
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number }
}

interface StravaRoute {
  id_str: string
  name: string
  distance: number
  elevation_gain: number | null
}

export interface StravaConfig {
  clientId: string
  redirectUri: string
  /** Fonction Supabase qui échange le code et rafraîchit le token : le secret client n'est jamais dans le navigateur */
  tokenEndpoint: string
  anonKey: string
}

export class StravaRoutes implements RouteLibrary {
  readonly source = 'Strava'

  constructor(
    private readonly config: StravaConfig,
    private readonly storage: Storage = sessionStorage,
  ) {}

  isConnected(): boolean {
    return this.session() !== null
  }

  beginConnection(): void {
    const state = crypto.randomUUID()
    this.storage.setItem(STATE_KEY, state)
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      approval_prompt: 'auto',
      // read_all : nécessaire pour les itinéraires privés
      scope: 'read,read_all',
      state,
    })
    location.assign(`${AUTHORIZE}?${params}`)
  }

  async finishConnection(code: string, state: string | null): Promise<void> {
    const expected = this.storage.getItem(STATE_KEY)
    this.storage.removeItem(STATE_KEY)
    if (!expected || state !== expected) throw new Error('Connexion Strava refusée : état de la demande invalide.')

    const token = await this.token({ code })
    if (!token.athlete) throw new Error('Strava n’a pas renvoyé l’identifiant de l’athlète.')
    this.save(token, token.athlete.id)
  }

  disconnect(): void {
    this.storage.removeItem(SESSION_KEY)
  }

  async list(): Promise<RouteSummary[]> {
    const session = await this.freshSession()
    const response = await this.api(`/athletes/${session.athleteId}/routes?per_page=100`, session)
    const routes = (await response.json()) as StravaRoute[]
    return routes.map((route) => ({
      id: route.id_str,
      name: route.name,
      distanceKm: route.distance / 1000,
      ascentM: route.elevation_gain,
    }))
  }

  async gpx(id: string): Promise<string> {
    const session = await this.freshSession()
    const response = await this.api(`/routes/${encodeURIComponent(id)}/export_gpx`, session)
    return response.text()
  }

  private async api(path: string, session: Session): Promise<Response> {
    const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}` } })
    if (response.status === 401) {
      this.disconnect()
      throw new Error('La connexion à Strava a expiré. Reconnectez-vous.')
    }
    if (response.status === 429) throw new Error('Strava limite le nombre de requêtes : réessayez dans quelques minutes.')
    if (!response.ok) throw new Error(`Strava a répondu HTTP ${response.status}`)
    return response
  }

  private async freshSession(): Promise<Session> {
    const session = this.session()
    if (!session) throw new Error('Strava n’est pas connecté.')
    // Marge d'une minute pour ne pas partir avec un token qui expire en route
    if (session.expiresAt - 60 > Date.now() / 1000) return session

    try {
      const token = await this.token({ refresh_token: session.refreshToken })
      return this.save(token, session.athleteId)
    } catch (error) {
      this.disconnect()
      throw error
    }
  }

  private async token(body: { code: string } | { refresh_token: string }): Promise<TokenResponse> {
    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: this.config.anonKey,
        Authorization: `Bearer ${this.config.anonKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Échange du jeton Strava refusé (HTTP ${response.status}).`)
    return (await response.json()) as TokenResponse
  }

  private save(token: TokenResponse, athleteId: number): Session {
    const session: Session = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
      athleteId,
    }
    this.storage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  }

  private session(): Session | null {
    const raw = this.storage.getItem(SESSION_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as Session
    } catch {
      return null
    }
  }
}
