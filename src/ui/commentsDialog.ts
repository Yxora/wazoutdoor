import { MAX_COMMENT_LENGTH, MAX_COMMENTS, SIGNALISATION_TYPE_LABEL, type Signalisation } from '../domain/signalisation'
import { CLOSE_ICON_PATH, odIcon } from './signalisationIcons'
import { showToast } from './toast'

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

/**
 * Conversation d'un signalement : tous les commentaires, du plus ancien au plus récent, et un champ pour ajouter le sien,
 * qui s'affiche sous les autres une fois envoyé.
 */
export function openCommentsDialog(
  initial: Signalisation,
  send: (signalisation: Signalisation, text: string) => Promise<Signalisation>,
  onChanged: (updated: Signalisation) => void,
): void {
  let current = initial

  const overlay = node('div', 'comments-dialog')
  const box = node('div', 'comments-dialog__box')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', `Conversation : ${SIGNALISATION_TYPE_LABEL[initial.type]}`)

  // Le focus qu'avait l'appelant (bouton de la popup) : on le lui rend à la fermeture
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const close = () => {
    document.removeEventListener('keydown', onKeydown)
    overlay.remove()
    if (opener?.isConnected) opener.focus()
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') return close()
    if (event.key !== 'Tab') return
    // Le focus reste dans la fenêtre : Tab ne repart pas derrière, sur la carte
    const focusable = [...box.querySelectorAll<HTMLElement>('button, textarea')].filter((el) => !el.hidden && !(el as HTMLButtonElement).disabled)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!box.contains(document.activeElement)) {
      event.preventDefault()
      first.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const closeButton = node('button', 'od-sheet__close')
  closeButton.type = 'button'
  closeButton.setAttribute('aria-label', 'Fermer')
  const closeIcon = odIcon(CLOSE_ICON_PATH, 18)
  closeIcon.setAttribute('class', 'od-sheet__close-icon')
  closeButton.append(closeIcon)
  closeButton.addEventListener('click', close)
  const header = node('div', 'comments-dialog__header')
  header.append(node('h2', 'od-sheet__title', SIGNALISATION_TYPE_LABEL[initial.type]), closeButton)

  const list = node('ul', 'comments-dialog__list')
  const empty = node('p', 'comments-dialog__empty', 'Aucun commentaire pour l’instant.')
  const render = () => {
    list.replaceChildren(
      ...(current.comments ?? []).map((comment) => {
        const item = node('li', 'comments-dialog__item', comment)
        return item
      }),
    )
    empty.hidden = (current.comments?.length ?? 0) > 0
    list.scrollTop = list.scrollHeight
  }

  const form = node('form', 'comments-dialog__form')
  const field = node('textarea', 'od-textarea')
  field.rows = 2
  field.maxLength = MAX_COMMENT_LENGTH
  field.required = true
  field.setAttribute('aria-label', 'Votre commentaire')
  field.placeholder = 'Ex. : contournable par la gauche'
  const error = node('p', 'od-error')
  error.hidden = true
  const submit = node('button', 'od-button od-button--primary', 'Envoyer')
  submit.type = 'submit'
  form.append(field, error, submit)
  if ((current.comments?.length ?? 0) >= MAX_COMMENTS) {
    form.replaceChildren(node('p', 'comments-dialog__empty', 'Cette conversation est complète.'))
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    submit.disabled = true
    error.hidden = true
    try {
      current = await send(current, field.value)
      field.value = ''
      render()
      showToast('Commentaire ajouté')
      // La carte se redessine et peut reprendre le focus : on le remet dans le champ
      onChanged(current)
      setTimeout(() => field.focus(), 0)
      if ((current.comments?.length ?? 0) >= MAX_COMMENTS) form.replaceChildren(node('p', 'comments-dialog__empty', 'Cette conversation est complète.'))
    } catch (cause) {
      error.textContent = `Impossible : ${cause instanceof Error ? cause.message : 'erreur réseau'}`
      error.hidden = false
    }
    submit.disabled = false
  })

  box.append(header, empty, list, form)
  overlay.append(box)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  document.addEventListener('keydown', onKeydown)
  document.body.append(overlay)
  render()
  // Après le clic qui ouvre la fenêtre, Leaflet touche encore à la popup : on attend la fin de l'événement pour prendre le focus
  setTimeout(() => field.focus(), 0)
}
