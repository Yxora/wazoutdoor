import { CLOSE_ICON_PATH, odIcon } from './signalisationIcons'

/** Affiche une photo en plein écran, fermée par la croix en haut à droite (ou Échap, ou un appui sur le fond). */
export function openPhotoViewer(src: string, alt: string): void {
  const viewer = document.createElement('div')
  viewer.className = 'photo-viewer'
  viewer.setAttribute('role', 'dialog')
  viewer.setAttribute('aria-modal', 'true')
  viewer.setAttribute('aria-label', alt)

  const image = document.createElement('img')
  image.className = 'photo-viewer__image'
  image.src = src
  image.alt = alt

  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'photo-viewer__close'
  close.setAttribute('aria-label', 'Fermer la photo')
  close.append(odIcon(CLOSE_ICON_PATH, 24))

  function dismiss() {
    document.removeEventListener('keydown', onKeydown)
    viewer.remove()
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') dismiss()
  }

  close.addEventListener('click', dismiss)
  viewer.addEventListener('click', (event) => {
    if (event.target === viewer) dismiss()
  })
  document.addEventListener('keydown', onKeydown)

  viewer.append(image, close)
  document.body.append(viewer)
  close.focus()
}
