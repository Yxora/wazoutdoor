import { createBrandLogo } from './brand'
import { el } from './dom'

/** Personnaliser sans compte : on propose de créer un compte, le score garde les critères standards */
export function createSignedOutPanel(signInForm: HTMLElement): HTMLElement {
  return el(
    'section',
    { className: 'account-panel' },
    createBrandLogo(),
    el('h2', {}, 'Personnalisez votre score'),
    el(
      'p',
      { className: 'signin__text' },
      'Créez un compte pour choisir vos activités, ce qui compte pour vous et vos Red flags. Un email suffit, sans mot de passe.',
    ),
    el('p', { className: 'hint' }, 'Sans compte, le score utilise les critères standards : tous les critères sont pris en compte, un feu proche reste éliminatoire.'),
    signInForm,
  )
}

/** Bas du panneau Personnaliser, avec compte : l'email et la déconnexion */
export function createAccountBar(email: string, onSignOut: () => Promise<void>): HTMLElement {
  const message = el('p', { className: 'od-error', hidden: true })
  const signOut = el('button', { type: 'button' }, 'Se déconnecter')
  signOut.addEventListener('click', async () => {
    signOut.disabled = true
    message.hidden = true
    try {
      await onSignOut()
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Déconnexion impossible.'
      message.hidden = false
      signOut.disabled = false
    }
  })
  return el('div', { className: 'account-bar' }, el('p', { className: 'hint' }, `Connecté·e : ${email}`), signOut, message)
}
