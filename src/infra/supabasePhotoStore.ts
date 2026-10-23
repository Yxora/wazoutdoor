import { AuthError } from '../application/authError'
import type { AuthGateway, PhotoStore } from '../application/ports'
import { accountHeaders, rejectedAccount } from './supabaseSignalisationStore'

const BUCKET = 'signalisation-photos'

/**
 * Envoie les photos dans le bucket public Supabase Storage `signalisation-photos` (voir migrations).
 * Chaque compte dépose dans son dossier `<user_id>/` : la policy d'insertion le vérifie.
 */
export class SupabasePhotoStore implements PhotoStore {
  private readonly base: string

  constructor(
    url: string,
    private readonly anonKey: string,
    private readonly auth: Pick<AuthGateway, 'accessToken' | 'current'>,
  ) {
    this.base = `${url.replace(/\/$/, '')}/storage/v1/object`
  }

  async upload(id: string, dataUrl: string): Promise<string> {
    const account = this.auth.current()
    if (!account) throw new AuthError('not_signed_in')
    const headers = await accountHeaders(this.auth, this.anonKey)
    const path = `${BUCKET}/${account.id}/${id}.jpg`
    const blob = await (await fetch(dataUrl)).blob()
    const response = await fetch(`${this.base}/${path}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: blob,
    })
    if (rejectedAccount(response)) throw new AuthError('not_signed_in')
    // 409 : la photo est déjà là (envoi précédent interrompu après l'upload), on réutilise l'adresse
    if (!response.ok && response.status !== 409) throw new Error(`Supabase : échec de l'envoi de la photo (HTTP ${response.status})`)
    return `${this.base}/public/${path}`
  }
}
