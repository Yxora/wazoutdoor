import type { AuthGateway } from '../application/ports'
import type { Account } from '../domain/account'

const DEMO_ACCOUNT: Account = { id: 'julie', email: 'julie@exemple.fr' }

/** Repli sans Supabase (démo hors ligne) : Julie est toujours connectée, rien ne passe par le réseau. */
export class LocalAuth implements AuthGateway {
  current(): Account {
    return DEMO_ACCOUNT
  }

  async sendSignInLink(): Promise<void> {
    throw new Error('Connexion indisponible : Supabase n’est pas configuré.')
  }

  async finishSignIn(): Promise<Account | null> {
    return null
  }

  async verifyCode(): Promise<Account> {
    throw new Error('Connexion indisponible : Supabase n’est pas configuré.')
  }

  async accessToken(): Promise<string | null> {
    return null
  }

  async signOut(): Promise<void> {}

  async deleteAccount(): Promise<void> {
    throw new Error('Suppression indisponible : Supabase n’est pas configuré.')
  }

  onChange(): void {}
}
