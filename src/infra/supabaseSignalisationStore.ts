import type { SignalisationStore } from '../application/ports'
import type { Signalisation, SignalisationType } from '../domain/signalisation'

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

/** Stocke les signalements dans la table Supabase `signalisations` (lecture et écriture publiques, voir migration SQL). */
export class SupabaseSignalisationStore implements SignalisationStore {
  private readonly endpoint: string
  private readonly headers: HeadersInit

  constructor(url: string, anonKey: string) {
    this.endpoint = `${url.replace(/\/$/, '')}/rest/v1/signalisations`
    this.headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
  }

  async save(signalisation: Signalisation): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { ...this.headers, Prefer: 'return=minimal' },
      body: JSON.stringify(toRow(signalisation)),
    })
    if (!response.ok) throw new Error(`Supabase : échec de l'enregistrement du signalement (HTTP ${response.status})`)
  }

  /** Fonctions SQL (voir migration) : le compteur de « plus là » doit être incrémenté de façon atomique */
  private async rpc(name: string, args: Record<string, string>): Promise<Signalisation> {
    const response = await fetch(`${this.endpoint.replace('/signalisations', '')}/rpc/${name}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(args),
    })
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

  async list(): Promise<Signalisation[]> {
    const response = await fetch(`${this.endpoint}?select=*&order=created_at.desc`, { headers: this.headers })
    if (!response.ok) throw new Error(`Supabase : échec de la lecture des signalements (HTTP ${response.status})`)
    const rows = (await response.json()) as SignalisationRow[]
    return rows.map(fromRow)
  }
}
