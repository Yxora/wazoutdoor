import { AuthError } from '../application/authError'
import type { AuthGateway, UserStore } from '../application/ports'
import { STANDARD_USER, type User } from '../domain/user'
import { accountHeaders, rejectedAccount } from './supabaseSignalisationStore'
import { parseUser } from './userValidation'

interface PreferencesRow {
  activities: unknown
  preferences: unknown
  signalisation_preferences: unknown
}

const cacheKey = (accountId: string) => `wazoutdoor:user:${accountId}`

/**
 * Préférences du compte dans la table Supabase `user_preferences`, avec une copie dans le navigateur par compte :
 * `get()` répond sans attendre le réseau, `load()` relit la base, `save()` écrit la copie puis la base sans bloquer la vue.
 * Un compte sans ligne en base part des critères standards.
 */
export class SupabaseUserStore implements UserStore {
  private readonly endpoint: string
  // Les écritures partent dans l'ordre : la dernière gagne
  private syncing: Promise<void> = Promise.resolve()

  constructor(
    url: string,
    private readonly anonKey: string,
    private readonly auth: Pick<AuthGateway, 'current' | 'accessToken'>,
    private readonly storage: Storage = localStorage,
  ) {
    this.endpoint = `${url.replace(/\/$/, '')}/rest/v1/user_preferences`
  }

  get(): User {
    const account = this.auth.current()
    if (!account) return STANDARD_USER
    try {
      const raw = this.storage.getItem(cacheKey(account.id))
      return raw ? parseUser(JSON.parse(raw), STANDARD_USER) : STANDARD_USER
    } catch {
      return STANDARD_USER
    }
  }

  async load(): Promise<User> {
    const account = this.auth.current()
    if (!account) return STANDARD_USER
    const response = await fetch(
      `${this.endpoint}?select=activities,preferences,signalisation_preferences&user_id=eq.${encodeURIComponent(account.id)}`,
      { headers: await accountHeaders(this.auth, this.anonKey) },
    )
    if (rejectedAccount(response)) throw new AuthError('not_signed_in')
    if (!response.ok) throw new Error(`Supabase : échec de la lecture des préférences (HTTP ${response.status})`)
    const [row] = (await response.json()) as PreferencesRow[]
    // Rien en base : la copie locale si elle existe (écriture pas encore arrivée), sinon les critères standards
    if (!row) return this.get()
    const user = parseUser(
      { activities: row.activities, preferences: row.preferences, signalisationPreferences: row.signalisation_preferences },
      STANDARD_USER,
    )
    this.writeCache(account.id, user)
    return user
  }

  save(user: User): void {
    const account = this.auth.current()
    if (!account) return
    this.writeCache(account.id, user)
    this.syncing = this.syncing
      .then(() => this.upsert(account.id, user))
      .catch((error) => console.error(`Préférences non enregistrées sur le serveur : ${error instanceof Error ? error.message : error}`))
  }

  /** Attend la fin des écritures en cours (tests) */
  whenSynced(): Promise<void> {
    return this.syncing
  }

  /** À la déconnexion : la copie locale ne reste pas sur un appareil partagé */
  clear(): void {
    const account = this.auth.current()
    if (!account) return
    try {
      this.storage.removeItem(cacheKey(account.id))
    } catch {
      // stockage indisponible : rien à effacer
    }
  }

  private writeCache(accountId: string, user: User): void {
    try {
      this.storage.setItem(cacheKey(accountId), JSON.stringify(user))
    } catch {
      // stockage indisponible (navigation privée) : la base reste la référence
    }
  }

  private async upsert(accountId: string, user: User): Promise<void> {
    const response = await fetch(`${this.endpoint}?on_conflict=user_id`, {
      method: 'POST',
      headers: {
        ...(await accountHeaders(this.auth, this.anonKey)),
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: accountId,
        activities: user.activities,
        preferences: user.preferences,
        signalisation_preferences: user.signalisationPreferences,
        updated_at: new Date().toISOString(),
      }),
    })
    if (rejectedAccount(response)) throw new AuthError('not_signed_in')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  }
}
