import { el } from './dom'

export interface SignInFormDeps {
  /** Envoie l'email avec le lien et le code. Rejette avec un message lisible. */
  sendLink(email: string): Promise<void>
  /** Vérifie le code à 6 chiffres. La vue qui contient le formulaire se met à jour par `AuthGateway.onChange`. */
  verifyCode(email: string, code: string): Promise<void>
  /** Redirige vers Google OAuth. Rejette avec un message lisible si indisponible. */
  signInWithGoogle(): Promise<void>
}

/** L'email en attente survit à un rechargement : la PWA peut être relancée pendant qu'on lit ses emails */
const PENDING_KEY = 'wazoutdoor:signin-pending'
const PENDING_TTL_MS = 60 * 60 * 1000
/** Supabase limite l'envoi à un email par minute pour une même adresse */
const RESEND_DELAY_S = 60

function readPending(): string | null {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { email?: string; at?: number } | null
    if (typeof pending?.email !== 'string' || typeof pending.at !== 'number') return null
    return Date.now() - pending.at < PENDING_TTL_MS ? pending.email : null
  } catch {
    return null
  }
}

function writePending(email: string | null): void {
  try {
    if (email) localStorage.setItem(PENDING_KEY, JSON.stringify({ email, at: Date.now() }))
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // stockage indisponible : il faudra redemander l'email après un rechargement
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Erreur inattendue, réessayez.'
}

/**
 * Connexion en deux temps : l'email, puis le code à 6 chiffres reçu (ou le lien, sur le même appareil).
 * Le code est le chemin principal dans la PWA installée, où le lien s'ouvre souvent dans un autre navigateur.
 */
export function createSignInForm(deps: SignInFormDeps): HTMLElement {
  const root = el('div', { className: 'signin' })

  const emailInput = el('input', { className: 'od-input', type: 'email', autocomplete: 'email', required: true, placeholder: 'vous@exemple.fr' })
  const emailError = el('p', { className: 'od-error', hidden: true })
  const sendButton = el('button', { className: 'od-button od-button--primary', type: 'submit' }, 'Recevoir un lien')
  const emailStep = el(
    'form',
    { className: 'signin__step', noValidate: true },
    el('label', { className: 'od-field' }, el('span', { className: 'od-field__label' }, 'Email'), emailInput),
    emailError,
    sendButton,
  )

  const sentText = el('p', { className: 'signin__text' })
  const codeInput = el('input', {
    className: 'od-input signin__code',
    inputMode: 'numeric',
    autocomplete: 'one-time-code',
    maxLength: 7,
    placeholder: '123456',
  })
  const codeError = el('p', { className: 'od-error', hidden: true })
  const verifyButton = el('button', { className: 'od-button od-button--primary', type: 'submit' }, 'Se connecter')
  const resendButton = el('button', { className: 'od-button od-button--secondary', type: 'button' }, 'Renvoyer l’email')
  const changeButton = el('button', { className: 'signin__link', type: 'button' }, 'Changer d’adresse')
  const codeStep = el(
    'form',
    { className: 'signin__step', noValidate: true, hidden: true },
    sentText,
    el('label', { className: 'od-field' }, el('span', { className: 'od-field__label' }, 'Code reçu par email'), codeInput),
    codeError,
    verifyButton,
    resendButton,
    changeButton,
  )

  const googleIcon = el('span', {})
  googleIcon.setAttribute('aria-hidden', 'true')
  googleIcon.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>'
  const googleButton = el('button', { className: 'od-button od-button--secondary', type: 'button' })
  googleButton.append(googleIcon, 'Continuer avec Google')
  const googleError = el('p', { className: 'od-error', hidden: true })
  const googleSection = el('div', { className: 'signin__google' }, el('p', { className: 'signin__separator' }, 'ou'), googleButton, googleError)

  root.append(emailStep, googleSection, codeStep)

  let email = ''
  let resendTimer: number | undefined

  function waitBeforeResend() {
    let remaining = RESEND_DELAY_S
    resendButton.disabled = true
    window.clearInterval(resendTimer)
    const tick = () => {
      resendButton.textContent = remaining > 0 ? `Renvoyer l’email (${remaining} s)` : 'Renvoyer l’email'
      if (remaining <= 0) {
        resendButton.disabled = false
        window.clearInterval(resendTimer)
      }
      remaining -= 1
    }
    tick()
    resendTimer = window.setInterval(() => (root.isConnected ? tick() : window.clearInterval(resendTimer)), 1000)
  }

  function showCodeStep(address: string) {
    email = address
    sentText.textContent = `Un email a été envoyé à ${address}. Saisissez le code reçu, ou ouvrez le lien sur ce téléphone.`
    emailStep.hidden = true
    googleSection.hidden = true
    codeStep.hidden = false
    codeError.hidden = true
    codeInput.value = ''
    codeInput.focus()
  }

  function showEmailStep() {
    writePending(null)
    window.clearInterval(resendTimer)
    codeStep.hidden = true
    emailStep.hidden = false
    googleSection.hidden = false
    emailInput.value = email
    emailInput.focus()
  }

  async function send(address: string, error: HTMLElement, button: HTMLButtonElement): Promise<boolean> {
    error.hidden = true
    button.disabled = true
    try {
      await deps.sendLink(address)
      writePending(address)
      return true
    } catch (failure) {
      error.textContent = messageOf(failure)
      error.hidden = false
      return false
    } finally {
      button.disabled = false
    }
  }

  emailStep.addEventListener('submit', async (event) => {
    event.preventDefault()
    const address = emailInput.value.trim()
    if (await send(address, emailError, sendButton)) {
      showCodeStep(address)
      waitBeforeResend()
    }
  })

  codeStep.addEventListener('submit', async (event) => {
    event.preventDefault()
    codeError.hidden = true
    verifyButton.disabled = true
    try {
      await deps.verifyCode(email, codeInput.value)
      writePending(null)
    } catch (failure) {
      codeError.textContent = messageOf(failure)
      codeError.hidden = false
    } finally {
      verifyButton.disabled = false
    }
  })

  resendButton.addEventListener('click', async () => {
    if (await send(email, codeError, resendButton)) waitBeforeResend()
  })
  changeButton.addEventListener('click', showEmailStep)

  googleButton.addEventListener('click', async () => {
    googleError.hidden = true
    googleButton.disabled = true
    try {
      await deps.signInWithGoogle()
    } catch (failure) {
      googleError.textContent = messageOf(failure)
      googleError.hidden = false
      googleButton.disabled = false
    }
  })

  // Retour dans l'app après avoir lu l'email : on reprend directement à la saisie du code
  const pending = readPending()
  if (pending) {
    email = pending
    emailInput.value = pending
    showCodeStep(pending)
  }

  return root
}
