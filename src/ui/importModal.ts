import { listLibraryRoutes } from '../application/listLibraryRoutes'
import type { RouteActivity, RouteLibrary, RouteSummary } from '../application/ports'
import { PROFILES, type ProfileId } from '../domain/profile'
import stravaLogoUrl from './assets/strava.svg'
import { el } from './dom'
import { BIKE_ICON_PATH, MOUNTAIN_ICON_PATH, odIcon, ROUTE_ICON_PATH, RUN_ICON_PATH } from './signalisationIcons'

export interface EvaluationRequest {
  profileId: ProfileId
  start: Date
  gpxText: string
}

export interface ImportModal {
  /** Limite les profils proposés aux activités de l'utilisateur */
  setActivities(activities: ProfileId[]): void
  open(): void
  close(): void
  isOpen(): boolean
  /** Appelé à chaque fermeture (croix, Échap, programmatique) */
  onClose(listener: () => void): void
  /** Calcul en cours : le formulaire reste affiché, le bouton est bloqué */
  setBusy(busy: boolean): void
  /** Affiche l'erreur et rouvre la modale si besoin */
  showError(message: string): void
  /** Ouvre la modale ; si elle est déjà ouverte et qu'un score existe, la ferme pour revenir à la carte */
  toggle(): void
  /** Une fois un score affiché, la modale peut être refermée */
  allowClose(): void
}

type Source = 'gpx' | 'strava'

function defaultStart(): Date {
  const start = new Date()
  start.setSeconds(0, 0)
  return start
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const ACTIVITY: Record<RouteActivity, { label: string; icon: string }> = {
  ride: { label: 'Vélo', icon: BIKE_ICON_PATH },
  mtb: { label: 'VTT', icon: BIKE_ICON_PATH },
  run: { label: 'Course', icon: RUN_ICON_PATH },
  trail: { label: 'Trail', icon: MOUNTAIN_ICON_PATH },
  other: { label: 'Autre', icon: ROUTE_ICON_PATH },
}

/** Miniature du tracé : longitude corrigée par la latitude pour ne pas déformer la forme */
function outlineThumbnail(outline: [number, number][]): SVGSVGElement | null {
  if (outline.length < 2) return null
  const lats = outline.map(([lat]) => lat)
  const lngs = outline.map(([, lng]) => lng)
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)]
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)]
  const k = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180))
  const width = (maxLng - minLng) * k
  const height = maxLat - minLat
  const scale = 40 / (Math.max(width, height) || 1)
  const offsetX = (48 - width * scale) / 2
  const offsetY = (48 - height * scale) / 2
  const points = outline
    .map(([lat, lng]) => `${(offsetX + (lng - minLng) * k * scale).toFixed(1)},${(offsetY + (maxLat - lat) * scale).toFixed(1)}`)
    .join(' ')

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 48 48')
  svg.setAttribute('class', 'route-item__thumb')
  svg.setAttribute('aria-hidden', 'true')
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
  line.setAttribute('points', points)
  line.setAttribute('fill', 'none')
  line.setAttribute('stroke', 'currentColor')
  line.setAttribute('stroke-width', '2.5')
  line.setAttribute('stroke-linecap', 'round')
  line.setAttribute('stroke-linejoin', 'round')
  svg.append(line)
  return svg
}

function routeContent(route: RouteSummary): Node[] {
  const ascent = route.ascentM === null ? '' : ` · +${Math.round(route.ascentM)} m`
  const activity = ACTIVITY[route.activity]
  return [
    outlineThumbnail(route.outline) ?? el('span', { className: 'route-item__thumb' }),
    el(
      'span',
      { className: 'route-item__text' },
      el('strong', {}, route.name),
      el('small', {}, `${route.distanceKm.toFixed(1)} km${ascent}`),
      el('small', { className: 'route-item__activity' }, odIcon(activity.icon, 16), activity.label),
    ),
  ]
}

/** Liste déroulante d'itinéraires (un <select> natif ne peut pas afficher de miniature ni d'icône) */
function routeDropdown(routes: RouteSummary[], onPick: (route: RouteSummary) => Promise<boolean>): HTMLElement {
  const placeholder = el('span', { className: 'route-item__text' }, 'Choisir un itinéraire…')
  const trigger = el('button', { type: 'button', className: 'route-item route-dropdown__trigger' }, placeholder)
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')

  const list = el('ul', { className: 'route-list', role: 'listbox' })
  list.hidden = true
  const wrapper = el('div', { className: 'route-dropdown' }, trigger, list)

  let isOpen = false
  function setOpen(open: boolean) {
    isOpen = open
    list.hidden = !open
    trigger.setAttribute('aria-expanded', String(open))
  }

  for (const route of routes) {
    const option = el('li', { role: 'option' }, ...routeContent(route))
    option.className = 'route-item'
    option.tabIndex = 0
    const pick = async () => {
      setOpen(false)
      if (await onPick(route)) trigger.replaceChildren(...routeContent(route))
    }
    option.addEventListener('click', pick)
    option.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        void pick()
      }
    })
    list.append(option)
  }

  trigger.addEventListener('click', () => setOpen(!isOpen))
  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen) {
      event.stopPropagation()
      setOpen(false)
      trigger.focus()
    }
  })
  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target as Node)) setOpen(false)
  })
  return wrapper
}

/** `accountSlot` reçoit le bouton « Déconnecter » tant que le compte est connecté */
function libraryPicker(library: RouteLibrary, onLoaded: (gpx: string, label: string) => void, accountSlot: HTMLElement): HTMLElement {
  const box = el('div', { className: 'library' })
  const status = el('p', { className: 'hint', role: 'status' })

  function showDisconnect(visible: boolean) {
    accountSlot.replaceChildren(...(visible ? [disconnectButton()] : []))
  }

  async function showRoutes() {
    status.textContent = `Chargement de vos itinéraires ${library.source}…`
    box.replaceChildren(status)
    const result = await listLibraryRoutes(library)
    if (!result.ok) {
      status.textContent = result.detail
      box.replaceChildren(status, connectButton())
      return
    }
    if (result.routes.length === 0) {
      status.textContent = `Aucun itinéraire trouvé sur ${library.source}.`
      showDisconnect(true)
      box.replaceChildren(status)
      return
    }
    const dropdown = routeDropdown(result.routes, async (route) => {
      status.textContent = `Chargement de « ${route.name} »…`
      try {
        onLoaded(await library.gpx(route.id), `${route.name} (${library.source})`)
        status.textContent = ''
        return true
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error)
        return false
      }
    })
    status.textContent = ''
    showDisconnect(true)
    box.replaceChildren(el('p', { className: 'hint' }, `Mes itinéraires ${library.source}`), dropdown, status)
  }

  function connectButton(): HTMLElement {
    const button = el('button', { type: 'button' }, `Connecter ${library.source}`)
    button.addEventListener('click', () => library.beginConnection())
    return button
  }

  function disconnectButton(): HTMLElement {
    const button = el('button', { type: 'button', className: 'button--small' }, `Déconnecter ${library.source}`)
    button.addEventListener('click', () => {
      library.disconnect()
      render()
    })
    return button
  }

  function render() {
    if (library.isConnected()) void showRoutes()
    else {
      showDisconnect(false)
      box.replaceChildren(connectButton(), el('p', { className: 'hint' }, `Powered by ${library.source}`))
    }
  }

  render()
  return box
}

/**
 * Modale plein écran de l'import : activité, heure de départ, source du tracé (GPX ou Strava), puis « Calculer le score ».
 * La carte n'est visible qu'une fois le score calculé.
 */
export function createImportModal(
  onEvaluate: (request: EvaluationRequest) => void,
  library?: RouteLibrary,
  activities: ProfileId[] = Object.keys(PROFILES) as ProfileId[],
): ImportModal {
  let gpxText: string | null = null
  // La modale ne s'ouvre plus d'elle-même à l'arrivée (onglet Vérifier) : on peut toujours la refermer
  let canClose = true
  let source = 'gpx' as Source

  const dialog = el('dialog', { className: 'modal import-modal' })
  dialog.setAttribute('aria-labelledby', 'import-title')
  dialog.addEventListener('cancel', (event) => {
    if (!canClose) event.preventDefault()
  })

  const gpxLabel = el('p', { className: 'hint' }, 'Aucun tracé choisi.')
  const fileInput = el('input', { type: 'file', accept: '.gpx,application/gpx+xml,text/xml' })
  const startInput = el('input', { type: 'datetime-local', required: true, value: toLocalInputValue(defaultStart()) })
  const submit = el('button', { type: 'submit', className: 'primary' }, 'Calculer le score')
  const message = el('p', { className: 'error', role: 'alert' })
  message.hidden = true

  function setGpx(text: string, label: string) {
    gpxText = text
    gpxLabel.textContent = `Tracé : ${label}`
  }

  let profileInputs: HTMLInputElement[] = []
  const profileField = el('fieldset', { className: 'profiles' })
  function renderProfiles(ids: ProfileId[], selected?: ProfileId) {
    const checked = selected && ids.includes(selected) ? selected : ids[0]
    profileInputs = ids.map((id) => el('input', { type: 'radio', name: 'profile', value: id, checked: id === checked }))
    profileField.replaceChildren(
      el('legend', {}, '1. Votre activité'),
      ...profileInputs.map((input) => el('label', {}, input, PROFILES[input.value as ProfileId].label)),
    )
  }
  renderProfiles(activities)

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (file) setGpx(await file.text(), file.name)
  })
  const gpxPane = el(
    'div',
    { className: 'source-pane' },
    el('label', { className: 'field' }, 'Fichier GPX', fileInput),
    gpxLabel,
  )
  const stravaAccount = el('div', { className: 'source-switch__account' })
  const stravaPane = el(
    'div',
    { className: 'source-pane' },
    library
      ? libraryPicker(library, (gpx, label) => {
          fileInput.value = ''
          setGpx(gpx, label)
        }, stravaAccount)
      : el('p', { className: 'hint' }, 'Import Strava non configuré.'),
  )

  const stravaImg = el('img', { src: stravaLogoUrl, alt: '', width: 20, height: 20 })
  const gpxOption = el('input', { type: 'radio', name: 'source', value: 'gpx', checked: source === 'gpx' })
  const stravaOption = el('input', { type: 'radio', name: 'source', value: 'strava', checked: source === 'strava', disabled: !library })
  const switchField = el(
    'fieldset',
    { className: 'source-switch' },
    el('legend', {}, '3. Votre tracé'),
    el('div', { className: 'source-switch__item' }, el('label', {}, gpxOption, 'Import GPX')),
    el('div', { className: 'source-switch__item' }, el('label', {}, stravaOption, stravaImg, 'Import Strava'), stravaAccount),
  )
  function renderSource() {
    gpxPane.hidden = source !== 'gpx'
    stravaPane.hidden = source !== 'strava'
  }
  for (const option of [gpxOption, stravaOption]) {
    option.addEventListener('change', () => {
      source = option.value as Source
      renderSource()
    })
  }
  renderSource()

  const form = el(
    'form',
    { className: 'form' },
    profileField,
    el('label', { className: 'field' }, '2. Heure de départ', startInput),
    switchField,
    gpxPane,
    stravaPane,
    message,
    submit,
  )
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (gpxText === null) {
      modal.showError(source === 'strava' ? 'Choisissez un itinéraire Strava.' : 'Choisissez un fichier GPX.')
      return
    }
    const profileId = (profileInputs.find((i) => i.checked)?.value ?? 'randonneur') as ProfileId
    const start = new Date(startInput.value)
    if (Number.isNaN(start.getTime())) {
      modal.showError('Indiquez une heure de départ valide.')
      return
    }
    message.hidden = true
    modal.setBusy(true)
    onEvaluate({ profileId, start, gpxText })
  })

  dialog.append(
    el('div', { className: 'modal__body' }, el('h1', { id: 'import-title' }, 'Vérifier une sortie'), form),
  )
  document.body.append(dialog)

  const modal: ImportModal = {
    setActivities(ids) {
      renderProfiles(ids, profileInputs.find((i) => i.checked)?.value as ProfileId | undefined)
    },
    open() {
      if (!dialog.open) dialog.show()
    },
    toggle() {
      if (dialog.open && canClose) dialog.close()
      else modal.open()
    },
    close() {
      dialog.close()
    },
    isOpen: () => dialog.open,
    onClose(listener) {
      dialog.addEventListener('close', listener)
    },
    setBusy(busy) {
      submit.disabled = busy
      submit.textContent = busy ? 'Calcul en cours…' : 'Calculer le score'
    },
    showError(text) {
      modal.setBusy(false)
      message.textContent = text
      message.hidden = false
      modal.open()
    },
    allowClose() {
      canClose = true
    },
  }

  return modal
}
