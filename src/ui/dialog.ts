import { CLOSE_ICON_PATH, odIcon } from './signalisationIcons'

export interface Dialog {
  /** Contenu de la fenêtre, sous l'en-tête (titre et croix) */
  box: HTMLElement
  close(): void
}

/**
 * Fenêtre par-dessus la carte : titre, croix, fermeture par Échap ou clic à côté, focus gardé à l'intérieur
 * et rendu à l'élément qui l'a ouverte. L'appelant ajoute son contenu dans `box`.
 */
export function openDialog(options: { title: string; label: string; className?: string; onClose?: () => void }): Dialog {
  const overlay = document.createElement('div')
  overlay.className = 'od-dialog'
  const box = document.createElement('div')
  box.className = ['od-dialog__box', options.className].filter(Boolean).join(' ')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', options.label)

  // Le focus qu'avait l'appelant (bouton de la popup) : on le lui rend à la fermeture
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

  const close = () => {
    document.removeEventListener('keydown', onKeydown)
    overlay.remove()
    if (opener?.isConnected) opener.focus()
    options.onClose?.()
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') return close()
    if (event.key !== 'Tab') return
    // Le focus reste dans la fenêtre : Tab ne repart pas derrière, sur la carte
    const focusable = [...box.querySelectorAll<HTMLElement>('button, textarea, input')].filter(
      (el) => !el.hidden && !(el as HTMLButtonElement).disabled && el.offsetParent !== null,
    )
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

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'od-sheet__close'
  closeButton.setAttribute('aria-label', 'Fermer')
  const closeIcon = odIcon(CLOSE_ICON_PATH, 18)
  closeIcon.setAttribute('class', 'od-sheet__close-icon')
  closeButton.append(closeIcon)
  closeButton.addEventListener('click', close)
  const header = document.createElement('div')
  header.className = 'od-dialog__header'
  const title = document.createElement('h2')
  title.className = 'od-sheet__title'
  title.textContent = options.title
  header.append(title, closeButton)

  box.append(header)
  overlay.append(box)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  document.addEventListener('keydown', onKeydown)
  document.body.append(overlay)
  return { box, close }
}
