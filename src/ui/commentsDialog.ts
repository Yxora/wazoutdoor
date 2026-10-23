import { MAX_COMMENT_LENGTH, MAX_COMMENTS, SIGNALISATION_TYPE_LABEL, type Signalisation } from '../domain/signalisation'
import { openDialog } from './dialog'
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

  const { box } = openDialog({
    title: SIGNALISATION_TYPE_LABEL[initial.type],
    label: `Conversation : ${SIGNALISATION_TYPE_LABEL[initial.type]}`,
    className: 'comments-dialog__box',
  })

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

  box.append(empty, list, form)
  render()
  // Après le clic qui ouvre la fenêtre, Leaflet touche encore à la popup : on attend la fin de l'événement pour prendre le focus
  setTimeout(() => field.focus(), 0)
}
