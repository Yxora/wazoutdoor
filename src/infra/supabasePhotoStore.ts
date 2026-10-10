import type { PhotoStore } from '../application/ports'

const BUCKET = 'signalisation-photos'

/** Envoie les photos dans le bucket public Supabase Storage `signalisation-photos` (voir migration SQL). */
export class SupabasePhotoStore implements PhotoStore {
  private readonly base: string

  constructor(
    url: string,
    private readonly anonKey: string,
  ) {
    this.base = `${url.replace(/\/$/, '')}/storage/v1/object`
  }

  async upload(id: string, dataUrl: string): Promise<string> {
    const blob = await (await fetch(dataUrl)).blob()
    const response = await fetch(`${this.base}/${BUCKET}/${id}.jpg`, {
      method: 'POST',
      headers: { apikey: this.anonKey, Authorization: `Bearer ${this.anonKey}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'false' },
      body: blob,
    })
    // 409 : la photo est déjà là (envoi précédent interrompu après l'upload), on réutilise l'adresse
    if (!response.ok && response.status !== 409) throw new Error(`Supabase : échec de l'envoi de la photo (HTTP ${response.status})`)
    return `${this.base}/public/${BUCKET}/${id}.jpg`
  }
}
