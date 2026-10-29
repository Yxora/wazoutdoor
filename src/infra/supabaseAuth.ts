import {
  GoTrueClient,
  isAuthPKCECodeVerifierMissingError,
  isAuthRetryableFetchError,
  type AuthError as SdkAuthError,
  type Session,
  type SupportedStorage,
} from '@supabase/auth-js'
import { AuthError, type AuthErrorCode } from '../application/authError'
import type { AuthGateway } from '../application/ports'
import type { Account } from '../domain/account'

/** Le SDK range sous cette clé la session et, à côté, le code_verifier PKCE */
const STORAGE_KEY = 'wazoutdoor:auth'
/** Marqueur ajouté à l'adresse de retour du lien : le retour Strava contient aussi ?code= */
const CALLBACK_PARAM = 'auth'
const CALLBACK_VALUE = 'callback'

/** Contexte de l'appel : la même erreur Supabase (`otp_expired`) veut dire « lien périmé » ou « code faux » */
type Context = 'link' | 'code'

export interface SupabaseAuthConfig {
  url: string
  anonKey: string
  /** Adresse de retour du lien, avec le marqueur (voir `callbackUrl`) */
  redirectTo: string
  storage?: SupportedStorage
  /** Pour les tests */
  fetch?: typeof fetch
}

/** Adresse de l'app avec le marqueur de retour, à déclarer dans les URL de redirection de Supabase */
export function callbackUrl(appUrl: string): string {
  const url = new URL(appUrl)
  url.search = ''
  url.hash = ''
  url.searchParams.set(CALLBACK_PARAM, CALLBACK_VALUE)
  return url.toString()
}

export function isSignInReturn(url: URL): boolean {
  return url.searchParams.get(CALLBACK_PARAM) === CALLBACK_VALUE
}

const EXPIRED = ['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'access_denied']

function codeFor(status: number | undefined, supabaseCode: string, context: Context): AuthErrorCode | null {
  if (status === 429 || supabaseCode.startsWith('over_')) return 'rate_limited'
  if (supabaseCode === 'email_address_invalid') return 'invalid_email'
  if (supabaseCode === 'bad_code_verifier') return 'missing_verifier'
  if (EXPIRED.includes(supabaseCode)) return context === 'code' ? 'wrong_code' : 'link_expired'
  return null
}

/** Traduit une erreur du SDK en erreur de l'application ; les cas imprévus gardent le message de Supabase */
function translate(error: SdkAuthError, context: Context): Error {
  if (isAuthRetryableFetchError(error)) return new AuthError('network')
  if (isAuthPKCECodeVerifierMissingError(error)) return new AuthError('missing_verifier')
  const code = codeFor(error.status, error.code ?? '', context)
  return code ? new AuthError(code) : new Error(`Supabase Auth : ${error.message}`)
}

/** Seul un compte email est un compte : une session anonyme est ignorée */
function accountOf(session: Session | null): Account | null {
  const user = session?.user
  if (!user?.email || user.is_anonymous) return null
  return { id: user.id, email: user.email }
}

/**
 * Supabase Auth par le SDK `@supabase/auth-js` : lien magique en flux PKCE, code à 6 chiffres.
 * Le SDK garde la session dans `localStorage`, rafraîchit le jeton et suit les autres onglets.
 * Le retour du lien est traité par `finishSignIn`, pas par le SDK, pour ne pas confondre avec le retour Strava.
 */
export class SupabaseAuth implements AuthGateway {
  private account: Account | null = null
  private readonly listeners: ((account: Account | null) => void)[] = []

  private constructor(
    private readonly client: GoTrueClient,
    private readonly redirectTo: string,
    /** Edge Function `delete-account` (voir supabase/functions) */
    private readonly deleteEndpoint: string,
    private readonly anonKey: string,
    private readonly fetch: typeof globalThis.fetch,
  ) {}

  /** Asynchrone : la session gardée est relue avant que `current()` serve */
  static async create(config: SupabaseAuthConfig): Promise<SupabaseAuth> {
    const client = new GoTrueClient({
      url: `${config.url.replace(/\/$/, '')}/auth/v1`,
      headers: { apikey: config.anonKey },
      storageKey: STORAGE_KEY,
      storage: config.storage,
      fetch: config.fetch,
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    })
    const auth = new SupabaseAuth(
      client,
      config.redirectTo,
      `${config.url.replace(/\/$/, '')}/functions/v1/delete-account`,
      config.anonKey,
      config.fetch ?? ((input, init) => globalThis.fetch(input, init)),
    )
    const { data } = await client.getSession()
    auth.account = accountOf(data.session)
    // Connexion dans un autre onglet, jeton refusé au rafraîchissement, déconnexion
    client.onAuthStateChange((_event, session) => auth.update(session))
    return auth
  }

  current(): Account | null {
    return this.account
  }

  async sendSignInLink(email: string): Promise<void> {
    const { error } = await this.client.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: this.redirectTo } })
    if (error) throw translate(error, 'link')
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.client.signInWithOAuth({ provider: 'google', options: { redirectTo: this.redirectTo } })
    if (error) throw translate(error, 'link')
  }

  async finishSignIn(url: URL): Promise<Account | null> {
    if (!isSignInReturn(url)) return null
    // Lien périmé : Supabase revient avec l'erreur dans la requête ou dans le fragment
    const hash = new URLSearchParams(url.hash.slice(1))
    const failure = url.searchParams.get('error_code') ?? hash.get('error_code') ?? url.searchParams.get('error') ?? hash.get('error')
    if (failure) throw new AuthError(codeFor(undefined, failure, 'link') ?? 'link_expired')

    const code = url.searchParams.get('code')
    if (!code) throw new AuthError('link_expired')
    const flowId = url.searchParams.get('sb_flow_id')
    const { data, error } = await this.client.exchangeCodeForSession(code, flowId ? { flowId } : undefined)
    if (error) throw translate(error, 'link')
    return this.accept(data.session)
  }

  async verifyCode(email: string, code: string): Promise<Account> {
    const { data, error } = await this.client.verifyOtp({ email, token: code, type: 'email' })
    if (error) throw translate(error, 'code')
    return this.accept(data.session)
  }

  async accessToken(): Promise<string | null> {
    // Le SDK rafraîchit le jeton s'il a expiré, un seul rafraîchissement à la fois
    const { data } = await this.client.getSession()
    return accountOf(data.session) ? data.session!.access_token : null
  }

  async signOut(): Promise<void> {
    // Le SDK efface la session locale même si la révocation échoue (pas de réseau)
    await this.client.signOut({ scope: 'local' })
    this.update(null)
  }

  /** Le serveur supprime le compte du jeton ; on efface ensuite la session de l'appareil */
  async deleteAccount(): Promise<void> {
    const token = await this.accessToken()
    if (!token) throw new AuthError('not_signed_in')
    let response: Response
    try {
      response = await this.fetch(this.deleteEndpoint, {
        method: 'POST',
        headers: { apikey: this.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
    } catch {
      throw new AuthError('network')
    }
    if (response.status === 401) throw new AuthError('not_signed_in')
    if (!response.ok) throw new Error('Suppression impossible pour le moment, réessayez plus tard.')
    await this.signOut()
  }

  onChange(listener: (account: Account | null) => void): void {
    this.listeners.push(listener)
  }

  private async accept(session: Session | null): Promise<Account> {
    const account = accountOf(session)
    if (!account) {
      await this.client.signOut({ scope: 'local' })
      throw new Error('Supabase Auth : réponse de connexion inattendue.')
    }
    this.update(session)
    return account
  }

  private update(session: Session | null): void {
    const next = accountOf(session)
    const changed = next?.id !== this.account?.id
    this.account = next
    if (changed) for (const listener of this.listeners) listener(next)
  }
}
