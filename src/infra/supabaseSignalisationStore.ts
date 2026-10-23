import { AuthError } from '../application/authError'
import type { AuthGateway, SignalisationStore } from '../application/ports'
import { ALREADY_VOTED_GONE, type Signalisation, type SignalisationType } from '../domain/signalisation'

interface SignalisationRow {
  id: string
  type: SignalisationType
  description: string
  lat: number
  lng: number
  created_at: string
  photo_url?: string | null
  gone_votes?: number | null
  comments?: string[] | null
}

function toRow(signalisation: Signalisation): SignalisationRow {
  return {
    id: signalisation.id,
    type: signalisation.type,
    description: signalisation.description,
    lat: signalisation.position.lat,
    lng: signalisation.position.lng,
    created_at: signalisation.createdAt.toISOString(),
    // Omis sans photo : l'enregistrement marche même si la migration photo n'est pas encore appliquée
    ...(signalisation.photoUrl ? { photo_url: signalisation.photoUrl } : {}),
  }
}

function fromRow(row: SignalisationRow): Signalisation {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    position: { lat: row.lat, lng: row.lng },
    createdAt: new Date(row.created_at),
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    ...(row.gone_votes ? { goneVotes: row.gone_votes } : {}),
    ...(row.comments?.length ? { comments: row.comments } : {}),
  }
}

/** Jeton du compte pour les écritures : sans session, ou si la base refuse le jeton, l'utilisateur·rice doit se connecter */
export async function accountHeaders(auth: Pick<AuthGateway, 'accessToken'>, anonKey: string): Promise<Record<string, string>> {
  const token = await auth.accessToken()
  if (!token) throw new AuthError('not_signed_in')
  return { apikey: anonKey, Authorization: `Bearer ${token}` }
}

export function rejectedAccount(response: Response): boolean {
  return response.status === 401 || response.status === 403
}

/** La fonction SQL lève `already_voted` quand le compte a déjà voté « plus là » sur ce signalement */
async function alreadyVoted(response: Response): Promise<boolean> {
  try {
    return ((await response.clone().json()) as { message?: string }).message === 'already_voted'
  } catch {
    return false
  }
}

/**
 * Stocke les signalements dans la table Supabase `signalisations`.
 * Lecture publique avec la clé anon ; écritures avec le jeton du compte (RLS, voir migration auth).
 */
export class SupabaseSignalisationStore implements SignalisationStore {
  private readonly endpoint: string
  private readonly headers: Record<string, string>

  constructor(
    url: string,
    private readonly anonKey: string,
    private readonly auth: Pick<AuthGateway, 'accessToken'>,
  ) {
    this.endpoint = `${url.replace(/\/$/, '')}/rest/v1/signalisations`
    this.headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  }

  private async writeHeaders(): Promise<Record<string, string>> {
    return { ...(await accountHeaders(this.auth, this.anonKey)), 'Content-Type': 'application/json' }
  }

  async save(signalisation: Signalisation): Promise<void> {
    // user_id est rempli par la base (default auth.uid())
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { ...(await this.writeHeaders()), Prefer: 'return=minimal' },
      body: JSON.stringify(toRow(signalisation)),
    })
    if (rejectedAccount(response)) throw new AuthError('not_signed_in')
    if (!response.ok) throw new Error(`Supabase : échec de l'enregistrement du signalement (HTTP ${response.status})`)
  }

  /** Fonctions SQL (voir migration) : le compteur de « plus là » doit être incrémenté de façon atomique */
  private async rpc(name: string, args: Record<string, string>): Promise<Signalisation> {
    const response = await fetch(`${this.endpoint.replace('/signalisations', '')}/rpc/${name}`, {
      method: 'POST',
      headers: await this.writeHeaders(),
      body: JSON.stringify(args),
    })
    if (rejectedAccount(response)) throw new AuthError('not_signed_in')
    if (response.status === 400 && (await alreadyVoted(response))) throw new Error(ALREADY_VOTED_GONE)
    if (!response.ok) throw new Error(`Supabase : échec de l'opération sur le signalement (HTTP ${response.status})`)
    const rows = (await response.json()) as SignalisationRow[] | SignalisationRow
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row) throw new Error('Signalement introuvable ou limite de commentaires atteinte')
    return fromRow(row)
  }

  confirm(id: string): Promise<Signalisation> {
    return this.rpc('confirm_signalisation', { p_id: id })
  }

  reportGone(id: string): Promise<Signalisation> {
    return this.rpc('report_signalisation_gone', { p_id: id })
  }

  addComment(id: string, text: string): Promise<Signalisation> {
    return this.rpc('add_signalisation_comment', { p_id: id, p_comment: text })
  }

  /** Sans session, aucun vote : on n'appelle pas le serveur */
  async myGoneVotes(): Promise<string[]> {
    if (!(await this.auth.accessToken())) return []
    const response = await fetch(`${this.endpoint.replace('/signalisations', '')}/rpc/my_gone_votes`, {
      method: 'POST',
      headers: await this.writeHeaders(),
      body: '{}',
    })
    if (rejectedAccount(response)) throw new AuthError('not_signed_in')
    if (!response.ok) throw new Error(`Supabase : échec de la lecture des votes (HTTP ${response.status})`)
    const rows = (await response.json()) as { signalisation_id: string }[]
    return rows.map((row) => row.signalisation_id)
  }

  async list(): Promise<Signalisation[]> {
    const response = await fetch(`${this.endpoint}?select=*&order=created_at.desc`, { headers: this.headers })
    if (!response.ok) throw new Error(`Supabase : échec de la lecture des signalements (HTTP ${response.status})`)
    const rows = (await response.json()) as SignalisationRow[]
    return rows.map(fromRow)
  }
}
