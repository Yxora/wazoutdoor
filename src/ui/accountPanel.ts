import { createBrandLogo } from './brand'
import { openDialog } from './dialog'
import { el } from './dom'
import { showToast } from './toast'

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

/** Droit à l'effacement : confirmation avant de supprimer le compte */
function openDeleteAccountDialog(onDeleteAccount: () => Promise<void>): void {
  const { box, close } = openDialog({ title: 'Supprimer mon compte', label: 'Supprimer mon compte' })
  const text = el(
    'p',
    { className: 'signin__text' },
    'Votre email et vos réglages seront effacés. Vos signalements restent visibles, sans lien avec vous.',
  )
  const error = el('p', { className: 'od-error', hidden: true })
  error.setAttribute('role', 'alert')
  const confirm = el('button', { type: 'button', className: 'od-button od-button--danger' }, 'Supprimer mon compte')
  confirm.addEventListener('click', async () => {
    confirm.disabled = true
    error.hidden = true
    try {
      await onDeleteAccount()
      close()
      showToast('Votre compte est supprimé.')
    } catch (cause) {
      error.textContent = cause instanceof Error ? cause.message : 'Suppression impossible.'
      error.hidden = false
      confirm.disabled = false
    }
  })
  box.append(text, confirm, error)
  setTimeout(() => confirm.focus(), 0)
}

/** Bas du panneau Personnaliser, avec compte : l'email, la déconnexion et la suppression du compte */
export function createAccountBar(email: string, onSignOut: () => Promise<void>, onDeleteAccount: () => Promise<void>): HTMLElement {
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
  const remove = el('button', { type: 'button', className: 'account-bar__delete' }, 'Supprimer mon compte')
  remove.addEventListener('click', () => openDeleteAccountDialog(onDeleteAccount))
  return el('div', { className: 'account-bar' }, el('p', { className: 'hint' }, `Connecté·e : ${email}`), signOut, message, remove)
}
