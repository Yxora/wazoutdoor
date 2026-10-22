/** Compte connecté par email. Pas de compte anonyme : sans compte, la carte est en lecture seule. */
export interface Account {
  /** Identifiant Supabase Auth (`auth.uid()`) */
  id: string
  email: string
}
