import type { LocationResult } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'
import {
  SIGNALISATION_TYPE_LABEL,
  SIGNALISATION_TYPES,
  type NearbySignalisations,
  type Signalisation,
  type SignalisationType,
} from '../domain/signalisation'
import { resizeToJpeg } from './photo'
import { showToast } from './toast'
import { CAMERA_ICON_PATH, CLOSE_ICON_PATH, LOCATION_ICON_PATH, odIcon, TYPE_ICON_PATH } from './signalisationIcons'

export interface SignalisationInput {
  position: Coordinates
  type: SignalisationType
  description: string
  /** Photo prise pour qualifier le signalement (data URL JPEG) */
  photo?: string
  /** Signalement proche de même type, à actualiser (position, détails, photo) au lieu d'en créer un nouveau */
  amend?: Signalisation
}

export interface SignalisationControlDeps {
  /** Signalements déjà présents autour de la position, pour éviter les doublons */
  findNearby(position: Coordinates, type: SignalisationType): Promise<NearbySignalisations>
  getCurrentPosition(): Promise<LocationResult>
  /** Un signalement de même type existe déjà à proximité : l'application ouvre le sien sur la carte */
  onExisting(existing: Signalisation, distanceM: number): void
  /** Enregistre le signalement et bascule sur la carte, centrée dessus */
  onSubmit(input: SignalisationInput): Promise<void> | void
}

export interface SignalisationControl {
  /** Ouvre la page de signalement d'un danger à la position GPS actuelle */
  start(): void
  /** Ferme la page (changement d'onglet, croix) */
  close(): void
}

function icon(pathD: string, size: number, className: string): SVGSVGElement {
  const element = odIcon(pathD, size)
  element.setAttribute('class', className)
  return element
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

function infoRow(iconPath: string, title: string, detail: string): { row: HTMLElement; setDetail(text: string): void } {
  const row = node('div', 'od-info-row')
  row.append(icon(iconPath, 24, 'od-info-row__icon'))
  const text = node('div', 'od-info-row__text')
  const detailEl = node('div', 'od-info-row__detail', detail)
  text.append(node('div', 'od-info-row__title', title), detailEl)
  row.append(text)
  return { row, setDetail: (value) => (detailEl.textContent = value) }
}

function metersLabel(meters: number): string {
  return `${Math.max(1, Math.round(meters))} m`
}

/** Question à deux boutons, posée par-dessus le formulaire. Résout `true` si l'on confirme. */
function ask(host: HTMLElement, message: string, confirmLabel: string, cancelLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = node('div', 'report-confirm')
    const box = node('div', 'report-confirm__box')
    box.setAttribute('role', 'alertdialog')
    box.setAttribute('aria-label', message)
    const confirm = node('button', 'od-button od-button--primary', confirmLabel)
    const cancel = node('button', 'od-button od-button--secondary', cancelLabel)
    confirm.type = cancel.type = 'button'
    const answer = (value: boolean) => {
      overlay.remove()
      resolve(value)
    }
    confirm.addEventListener('click', () => answer(true))
    cancel.addEventListener('click', () => answer(false))
    box.append(node('p', 'report-confirm__text', message), confirm, cancel)
    overlay.append(box)
    host.append(overlay)
    confirm.focus()
  })
}

/**
 * Signalement d'un danger sur la position GPS actuelle (chart WazeOutdoor), dans une page à part entière :
 * le formulaire défile, le bouton d'envoi reste toujours visible en bas.
 * Déclenché par l'onglet « Signaler » du menu du bas.
 */
export function createSignalisationControl(deps: SignalisationControlDeps): SignalisationControl {
  const { getCurrentPosition, findNearby, onExisting, onSubmit } = deps
  let page: HTMLElement | null = null

  function close() {
    document.removeEventListener('keydown', onKeydown)
    page?.remove()
    page = null
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  function start() {
    if (page) return
    page = build()
    document.addEventListener('keydown', onKeydown)
    document.body.append(page)
  }

  function build(): HTMLElement {
    let position: Coordinates | null = null
    let selectedType: SignalisationType = SIGNALISATION_TYPES[0]
    let photo: string | undefined

    const root = node('div', 'report-page')
    root.setAttribute('role', 'dialog')
    root.setAttribute('aria-label', 'Signaler un danger')

    const closeButton = node('button', 'od-sheet__close')
    closeButton.type = 'button'
    closeButton.setAttribute('aria-label', 'Fermer')
    closeButton.append(icon(CLOSE_ICON_PATH, 18, 'od-sheet__close-icon'))
    closeButton.addEventListener('click', close)
    const header = node('div', 'report-page__header')
    header.append(node('h2', 'od-sheet__title', 'Signaler un danger'), closeButton)

    const body = node('div', 'report-page__body')

    const location = infoRow(LOCATION_ICON_PATH, 'Position actuelle', 'Recherche de votre position…')
    const locationError = node('p', 'od-error')
    locationError.hidden = true
    const retry = node('button', 'od-button od-button--secondary', 'Réessayer')
    retry.type = 'button'
    retry.hidden = true

    body.append(location.row, locationError, retry)

    const grid = node('div', 'od-grid')
    const tiles: HTMLButtonElement[] = []
    for (const type of SIGNALISATION_TYPES) {
      const tile = node('button', 'od-tile')
      tile.type = 'button'
      tile.setAttribute('aria-pressed', String(type === selectedType))
      tile.append(icon(TYPE_ICON_PATH[type], 24, 'od-tile__icon'), document.createTextNode(SIGNALISATION_TYPE_LABEL[type]))
      tile.addEventListener('click', () => {
        selectedType = type
        for (const t of tiles) t.setAttribute('aria-pressed', String(t === tile))
      })
      tiles.push(tile)
      grid.append(tile)
    }

    const descField = node('label', 'od-field')
    const description = node('textarea', 'od-textarea')
    description.rows = 3
    description.maxLength = 280
    description.placeholder = 'Utile pour les autres : où exactement, comment contourner…'
    descField.append(node('span', 'od-field__label', 'Détails (facultatif)'), description)

    // Photo facultative : l'appareil photo s'ouvre directement sur mobile
    const photoInput = node('input', '')
    photoInput.type = 'file'
    photoInput.accept = 'image/*'
    photoInput.setAttribute('capture', 'environment')
    photoInput.hidden = true
    const photoPreview = node('img', 'od-sheet__photo')
    photoPreview.alt = 'Photo du signalement'
    photoPreview.hidden = true
    const photoMessage = node('p', 'od-error')
    photoMessage.hidden = true
    const photoButton = node('button', 'od-button od-button--secondary')
    photoButton.type = 'button'
    photoButton.append(icon(CAMERA_ICON_PATH, 20, 'od-button__icon'), document.createTextNode('Ajouter une photo'))
    photoButton.addEventListener('click', () => photoInput.click())
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0]
      if (!file) return
      photoMessage.hidden = true
      try {
        photo = await resizeToJpeg(file)
        photoPreview.src = photo
        photoPreview.hidden = false
        photoButton.lastChild!.textContent = 'Refaire la photo'
      } catch {
        photoMessage.textContent = 'Photo impossible à utiliser. Réessayez.'
        photoMessage.hidden = false
      }
    })

    body.append(grid, descField, photoButton, photoPreview, photoMessage, photoInput)

    const errorMessage = node('p', 'od-error')
    errorMessage.hidden = true
    const submit = node('button', 'od-button od-button--primary', 'Envoyer le signalement')
    submit.type = 'button'
    submit.disabled = true
    const footer = node('div', 'report-page__footer')
    footer.append(errorMessage, submit)

    root.append(header, body, footer)

    async function locate() {
      submit.disabled = true
      retry.hidden = true
      locationError.hidden = true
      location.setDetail('Recherche de votre position…')
      const result = await getCurrentPosition()
      if (!root.isConnected) return
      if (result.ok) {
        position = result.position
        location.setDetail('Capturée à l’instant')
        submit.disabled = false
      } else {
        location.setDetail('Position indisponible')
        locationError.textContent = 'Autorisez la géolocalisation pour signaler un danger à votre position.'
        locationError.hidden = false
        retry.hidden = false
      }
    }
    retry.addEventListener('click', () => void locate())

    submit.addEventListener('click', async () => {
      if (!position) return
      submit.disabled = true
      errorMessage.hidden = true
      try {
        // Évite les doublons : si la vérification échoue, on n'empêche pas d'envoyer
        const nearby = await findNearby(position, selectedType).catch((): NearbySignalisations => ({ otherTypes: [] }))
        if (nearby.sameType) {
          // Pas de doublon : on ferme le formulaire et on ouvre le signalement existant (toujours là / plus là / commentaire)
          const { signalisation, distanceM } = nearby.sameType
          close()
          onExisting(signalisation, distanceM)
          return
        }
        if (nearby.otherTypes.length) {
          const labels = [...new Set(nearby.otherTypes.map(({ signalisation }) => `« ${SIGNALISATION_TYPE_LABEL[signalisation.type]} »`))]
          const closest = nearby.otherTypes[0].distanceM
          const proceed = await ask(
            root,
            `Un signalement d’un autre type (${labels.join(', ')}) existe déjà à moins de ${metersLabel(closest)}. Souhaitez-vous tout de même ajouter le vôtre ?`,
            'Ajouter le mien',
            'Annuler',
          )
          if (!proceed) {
            submit.disabled = false
            return
          }
        }
        await onSubmit({ position, type: selectedType, description: description.value, photo })
        close()
        showToast('Signalement bien envoyé')
      } catch (error) {
        errorMessage.textContent = `Envoi impossible : ${error instanceof Error ? error.message : 'erreur réseau'}. Réessayez.`
        errorMessage.hidden = false
        submit.disabled = false
      }
    })

    void locate()
    return root
  }

  return { start, close }
}
