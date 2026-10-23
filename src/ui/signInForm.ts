import { el } from './dom'

export interface SignInFormDeps {
  /** Envoie l'email avec le lien et le code. Rejette avec un message lisible. */
  sendLink(email: string): Promise<void>
  /** Vérifie le code à 6 chiffres. La vue qui contient le formulaire se met à jour par `AuthGateway.onChange`. */
  verifyCode(email: string, code: string): Promise<void>
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

  root.append(emailStep, codeStep)

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

  // Retour dans l'app après avoir lu l'email : on reprend directement à la saisie du code
  const pending = readPending()
  if (pending) {
    email = pending
    emailInput.value = pending
    showCodeStep(pending)
  }

  return root
}
