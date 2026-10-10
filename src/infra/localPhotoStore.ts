import type { PhotoStore } from '../application/ports'

/** Repli sans Supabase : la photo reste dans le navigateur, avec le signalement */
export class LocalPhotoStore implements PhotoStore {
  async upload(_id: string, dataUrl: string): Promise<string> {
    return dataUrl
  }
}
