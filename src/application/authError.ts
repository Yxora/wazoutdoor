import type { Account } from '../domain/account'
import type { AuthGateway } from './ports'

export type AuthErrorCode =
  | 'not_signed_in'
  | 'invalid_email'
  | 'rate_limited'
  | 'link_expired'
  | 'wrong_code'
  | 'missing_verifier'
  | 'network'

const MESSAGES: Record<AuthErrorCode, string> = {
  not_signed_in: 'Connectez-vous pour continuer.',
  invalid_email: 'Adresse email invalide.',
  rate_limited: 'Trop de demandes, réessayez dans quelques minutes.',
  link_expired: 'Ce lien ou ce code n’est plus valable, demandez-en un nouveau.',
  wrong_code: 'Code incorrect.',
  missing_verifier: 'Ce lien doit être ouvert dans l’app où vous l’avez demandé. Saisissez plutôt le code reçu par email.',
  network: 'Pas de connexion, réessayez quand vous aurez du réseau.',
}

/** Erreur d'authentification : la vue choisit son message d'après le code */
export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode, message = MESSAGES[code]) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

/** Toute écriture passe par ici. Le serveur (RLS) refuse aussi : ce contrôle sert à afficher le bon message. */
export function requireAccount(auth: Pick<AuthGateway, 'current'>): Account {
  const account = auth.current()
  if (!account) throw new AuthError('not_signed_in')
  return account
}
