import type { Account } from '../domain/account'
import { AuthError } from './authError'
import type { AuthGateway } from './ports'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CODE = /^\d{6}$/

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL.test(normalized)) throw new AuthError('invalid_email')
  return normalized
}

/** Envoie l'email de connexion (lien et code). Un email invalide est refusé sans appel réseau. */
export async function sendSignInLink(auth: AuthGateway, email: string): Promise<void> {
  return auth.sendSignInLink(normalizeEmail(email))
}

/** Termine la connexion au retour du lien ; null si l'URL n'en est pas un */
export function finishSignIn(auth: AuthGateway, url: URL): Promise<Account | null> {
  return auth.finishSignIn(url)
}

/** Vérifie le code reçu par email. Les espaces sont tolérés (« 123 456 »), le reste est refusé sans appel réseau. */
export async function verifyCode(auth: AuthGateway, email: string, code: string): Promise<Account> {
  const digits = code.replace(/\s/g, '')
  if (!CODE.test(digits)) throw new AuthError('wrong_code')
  return auth.verifyCode(normalizeEmail(email), digits)
}

/** Redirige vers Google OAuth ; le retour passe par `finishSignIn` (même flux PKCE que le lien magique). */
export function signInWithGoogle(auth: AuthGateway): Promise<void> {
  return auth.signInWithGoogle()
}
