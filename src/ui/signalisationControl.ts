import type { LocationResult } from '../application/ports'
import type { Coordinates } from '../domain/coordinates'
import { SIGNALISATION_TYPE_LABEL, SIGNALISATION_TYPES, type SignalisationType } from '../domain/signalisation'
import { CLOSE_ICON_PATH, LOCATION_ICON_PATH, odIcon, PLUS_ICON_PATH, TYPE_ICON_PATH } from './signalisationIcons'

export interface SignalisationInput {
  position: Coordinates
  type: SignalisationType
  description: string
}

export interface SignalisationControlDeps {
  getCurrentPosition(): Promise<LocationResult>
  onSubmit(input: SignalisationInput): Promise<void> | void
}

interface Sheet {
  body: HTMLElement
  open(): void
  close(): void
}

function icon(pathD: string, size: number, className: string): SVGSVGElement {
  const element = odIcon(pathD, size)
  element.setAttribute('class', className)
  return element
}

function createSheet(title: string, subtitle: string): Sheet {
  const backdrop = document.createElement('div')
  backdrop.className = 'od-backdrop'

  const sheet = document.createElement('div')
  sheet.className = 'od-sheet'

  const handle = document.createElement('div')
  handle.className = 'od-sheet__handle'

  const heading = document.createElement('div')
  heading.className = 'od-sheet__heading'
  const titleEl = document.createElement('h2')
  titleEl.className = 'od-sheet__title'
  titleEl.textContent = title
  heading.append(titleEl)
  if (subtitle) {
    const subtitleEl = document.createElement('p')
    subtitleEl.className = 'od-sheet__subtitle'
    subtitleEl.textContent = subtitle
    heading.append(subtitleEl)
  }

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'od-sheet__close'
  closeButton.setAttribute('aria-label', 'Fermer')
  closeButton.append(icon(CLOSE_ICON_PATH, 18, 'od-sheet__close-icon'))

  const header = document.createElement('div')
  header.className = 'od-sheet__header'
  header.append(heading, closeButton)

  sheet.append(handle, header)
  backdrop.append(sheet)

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }

  function close() {
    document.removeEventListener('keydown', onKeydown)
    backdrop.remove()
  }

  closeButton.addEventListener('click', close)
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close()
  })

  return {
    body: sheet,
    close,
    open() {
      document.addEventListener('keydown', onKeydown)
      document.body.append(backdrop)
    },
  }
}

function infoRow(iconPath: string, title: string, detail: string): HTMLElement {
  const row = document.createElement('div')
  row.className = 'od-info-row'
  row.append(icon(iconPath, 24, 'od-info-row__icon'))

  const text = document.createElement('div')
  text.className = 'od-info-row__text'
  const titleEl = document.createElement('div')
  titleEl.className = 'od-info-row__title'
  titleEl.textContent = title
  const detailEl = document.createElement('div')
  detailEl.className = 'od-info-row__detail'
  detailEl.textContent = detail
  text.append(titleEl, detailEl)

  row.append(text)
  return row
}

/**
 * Bouton « Signaler » (chart WazeOutdoor) : signale un danger à l'instant, sur la position GPS actuelle.
 */
export function createSignalisationControl(deps: SignalisationControlDeps): void {
  const { getCurrentPosition, onSubmit } = deps

  const fab = document.createElement('button')
  fab.type = 'button'
  fab.className = 'od-fab'
  fab.title = 'Signaler un danger'
  fab.setAttribute('aria-label', 'Signaler un danger à ma position actuelle')
  fab.append(icon(PLUS_ICON_PATH, 26, ''))
  document.body.append(fab)

  fab.addEventListener('click', startPositionReport)

  async function startPositionReport() {
    fab.disabled = true
    const loading = createSheet('Signaler un danger', 'Recherche de votre position…')
    loading.open()
    const result = await getCurrentPosition()
    loading.close()
    fab.disabled = false

    if (!result.ok) {
      const errorSheet = createSheet('Position indisponible', '')
      const message = document.createElement('p')
      message.className = 'od-error'
      message.textContent = 'Autorisez la géolocalisation pour signaler un danger à votre position.'
      const retry = document.createElement('button')
      retry.type = 'button'
      retry.className = 'od-button od-button--primary'
      retry.textContent = 'Réessayer'
      retry.addEventListener('click', () => {
        errorSheet.close()
        startPositionReport()
      })
      const actions = document.createElement('div')
      actions.className = 'od-actions'
      actions.append(retry)
      errorSheet.body.append(message, actions)
      errorSheet.open()
      return
    }

    openReportSheet(result.position)
  }

  function openReportSheet(position: Coordinates) {
    const sheet = createSheet('Que signalez-vous ?', '')

    sheet.body.append(infoRow(LOCATION_ICON_PATH, 'Position actuelle', 'Capturée à l’instant'))

    const grid = document.createElement('div')
    grid.className = 'od-grid'
    let selectedType: SignalisationType = SIGNALISATION_TYPES[0]
    const tiles: HTMLButtonElement[] = []
    for (const type of SIGNALISATION_TYPES) {
      const tile = document.createElement('button')
      tile.type = 'button'
      tile.className = 'od-tile'
      tile.setAttribute('aria-pressed', String(type === selectedType))
      tile.append(icon(TYPE_ICON_PATH[type], 24, 'od-tile__icon'), document.createTextNode(SIGNALISATION_TYPE_LABEL[type]))
      tile.addEventListener('click', () => {
        selectedType = type
        for (const t of tiles) t.setAttribute('aria-pressed', String(t === tile))
      })
      tiles.push(tile)
      grid.append(tile)
    }
    sheet.body.append(grid)

    const descField = document.createElement('label')
    descField.className = 'od-field'
    const descLabel = document.createElement('span')
    descLabel.className = 'od-field__label'
    descLabel.textContent = 'Détails (facultatif)'
    const description = document.createElement('textarea')
    description.className = 'od-textarea'
    description.rows = 3
    description.maxLength = 280
    description.placeholder = 'Utile pour les autres : où exactement, comment contourner…'
    descField.append(descLabel, description)
    sheet.body.append(descField)

    const form = document.createElement('form')
    form.className = 'od-sheet__form'
    const errorMessage = document.createElement('p')
    errorMessage.className = 'od-error'
    errorMessage.hidden = true
    const actions = document.createElement('div')
    actions.className = 'od-actions'
    const submit = document.createElement('button')
    submit.type = 'submit'
    submit.className = 'od-button od-button--primary'
    submit.textContent = 'Envoyer le signalement'
    actions.append(submit)
    form.append(errorMessage, actions)
    sheet.body.append(form)

    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      submit.disabled = true
      errorMessage.hidden = true
      try {
        await onSubmit({ position, type: selectedType, description: description.value })
        sheet.close()
      } catch (error) {
        errorMessage.textContent = `Envoi impossible : ${error instanceof Error ? error.message : 'erreur réseau'}. Réessayez.`
        errorMessage.hidden = false
      } finally {
        submit.disabled = false
      }
    })

    sheet.open()
  }
}
