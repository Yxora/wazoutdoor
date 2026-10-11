import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '../domain/coordinates'
import { PLACE_CATEGORY_LABEL, type Place, type PlaceCategory } from '../domain/place'
import type { ProtectedArea } from '../domain/protectedArea'
import type { Route } from '../domain/route'
import { isGonePending, isLive, SIGNALISATION_TYPE_LABEL, signalisationStatus, type Signalisation, type SignalisationType } from '../domain/signalisation'
import { pictoIcon } from './pictos'
import { isDisplayablePhoto } from './photo'
import { openPhotoViewer } from './photoViewer'
import { CHECK_ICON_PATH, CLOSE_ICON_PATH, odIcon, WARNING_ICON_PATH } from './signalisationIcons'
import { openCommentsDialog } from './commentsDialog'
import { showToast } from './toast'
import logoUrl from './assets/logo.png'

// Centre des Vosges, cible de départ du projet
const VOSGES: L.LatLngTuple = [48.0, 7.0]
const ZOOM_INITIAL = 9


// Glyphes SVG statiques (viewBox 24). Chaque catégorie a une couleur ET un dessin différents :
// la couleur ne doit pas être le seul moyen de distinguer les lieux. Couleurs : palette « pictos » du chart, le dessin fait la différence.
const GLYPH = {
  drop: '<path d="M12 3.5c-3 4-6 7.3-6 10.6a6 6 0 0 0 12 0c0-3.3-3-6.6-6-10.6z"/>',
  tent: '<path fill-rule="evenodd" d="M12 4 2.5 19h19L12 4zm0 7 3.6 6H8.4L12 11z"/>',
  house: '<path d="M12 3.5 2.5 12H5v7.5h5v-5h4v5h5V12h2.5L12 3.5z"/>',
  bed: '<path d="M3 6h2v9h14v-3.5C19 9.6 17.4 8 15.5 8H10v5H5V6z"/><path d="M3 15h18v3H3z"/>',
  flag: '<path d="M6 3h2v18H6V3zm2 1h10l-2.5 4 2.5 4H8V4z"/>',
} as const

export interface MarkerStyle {
  label: string
  color: string
  glyph: string
  /** Couleur du glyphe : l'encre sur les aplats clairs du chart, le blanc sur l'encre */
  glyphColor?: string
}

const START_STYLE: MarkerStyle = { label: 'Départ du tracé', color: 'var(--od-ink)', glyph: GLYPH.flag, glyphColor: 'var(--od-ink-inverse)' }

const CATEGORY_STYLE: Record<PlaceCategory, MarkerStyle> = {
  water: { label: PLACE_CATEGORY_LABEL.water, color: 'var(--od-picto-water)', glyph: GLYPH.drop },
  hut: { label: PLACE_CATEGORY_LABEL.hut, color: 'var(--od-picto-earth)', glyph: GLYPH.tent },
  refuge: { label: PLACE_CATEGORY_LABEL.refuge, color: 'var(--od-picto-rock)', glyph: GLYPH.house },
  lodge: { label: PLACE_CATEGORY_LABEL.lodge, color: 'var(--od-picto-leaf)', glyph: GLYPH.bed },
}

const LEGEND_CATEGORIES: PlaceCategory[] = ['water', 'hut', 'refuge', 'lodge']

/** Pastille ronde colorée contenant un glyphe. Même rendu sur la carte, dans la légende et dans le formulaire. */
export function badge(style: MarkerStyle): HTMLElement {
  const element = document.createElement('span')
  element.className = 'map-badge'
  element.style.background = style.color
  if (style.glyphColor) element.style.color = style.glyphColor
  // Contenu statique défini dans ce fichier, jamais issu d'une source externe
  element.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">${style.glyph}</svg>`
  return element
}

/**
 * Pastille « danger signalé » : le picto dit quoi (planche des pictos d'imprévus), la gravité reste portée par une forme de statut
 * en coin (triangle « attention »), jamais par la couleur seule. Chart WazeOutdoor.
 */
function dangerPinBadge(type: SignalisationType, legend = false, redFlag = false, toConfirm = false, gonePending = false): HTMLElement {
  const element = document.createElement('span')
  const wave = redFlag ? 'od-pin--redflag' : ''
  const faded = gonePending ? 'od-pin--gone' : toConfirm ? 'od-pin--toconfirm' : ''
  element.className = [legend ? 'od-pin od-pin--legend' : 'od-pin', wave, faded].filter(Boolean).join(' ')
  const status = document.createElement('span')
  status.className = 'od-pin__status'
  status.append(odIcon(WARNING_ICON_PATH, legend ? 10 : 14))
  element.append(pictoIcon(type, legend ? 20 : 28), status)
  return element
}

function dangerPinIcon(signalisation: Signalisation, redFlag: boolean, toConfirm: boolean): L.DivIcon {
  return L.divIcon({
    html: dangerPinBadge(signalisation.type, false, redFlag, toConfirm, isGonePending(signalisation)),
    className: 'map-marker map-marker--danger',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

function markerIcon(style: MarkerStyle, group: string): L.DivIcon {
  return L.divIcon({
    html: badge(style),
    className: `map-marker map-marker--${group}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

/**
 * Groupes de la carte que la légende permet d'afficher ou de masquer. Le masquage passe par une classe CSS sur la carte
 * (`map--hide-<groupe>`), donc il survit aux rechargements du tracé et des signalements.
 */
type LayerGroup = 'route' | PlaceCategory | 'protected' | 'danger' | 'position'

function legendRow(map: L.Map, group: LayerGroup, symbol: HTMLElement, label: string): HTMLElement {
  const row = document.createElement('li')
  row.className = 'map-legend__row'
  const toggle = document.createElement('label')
  toggle.className = 'map-legend__toggle'
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = !map.getContainer().classList.contains(`map--hide-${group}`)
  checkbox.addEventListener('change', () => map.getContainer().classList.toggle(`map--hide-${group}`, !checkbox.checked))
  toggle.append(checkbox, symbol, label)
  row.append(toggle)
  return row
}

function addLegend(map: L.Map): void {
  const legend = new L.Control({ position: 'topleft' })

  legend.onAdd = () => {
    const box = L.DomUtil.create('details', 'map-legend') as HTMLDetailsElement
    // Repliée par défaut sur petit écran pour ne pas masquer la carte
    box.open = window.innerWidth > 600
    box.setAttribute('aria-label', 'Légende de la carte')
    L.DomEvent.disableClickPropagation(box)

    const summary = document.createElement('summary')
    summary.textContent = 'Légende'

    const line = document.createElement('span')
    line.className = 'map-legend__line'

    const dot = document.createElement('span')
    dot.className = 'map-legend__dot'

    const zone = document.createElement('span')
    zone.className = 'map-legend__zone'

    const hint = document.createElement('p')
    hint.className = 'map-legend__hint'
    hint.textContent = 'Cochez pour afficher ou masquer.'

    const list = document.createElement('ul')
    list.className = 'map-legend__list'
    list.append(
      legendRow(map, 'route', line, 'Tracé et départ'),
      ...LEGEND_CATEGORIES.map((category) => legendRow(map, category, badge(CATEGORY_STYLE[category]), CATEGORY_STYLE[category].label)),
      legendRow(map, 'position', dot, 'Votre position'),
      legendRow(map, 'protected', zone, 'Zone protégée'),
      legendRow(map, 'danger', dangerPinBadge('arbre', true), 'Danger signalé (le picto dit lequel)'),
    )

    box.append(summary, hint, list)
    return box
  }

  legend.addTo(map)
}

function addLogo(map: L.Map): void {
  const logo = new L.Control({ position: 'topright' })
  logo.onAdd = () => {
    const img = L.DomUtil.create('img', 'map-logo') as HTMLImageElement
    img.src = logoUrl
    img.alt = 'Wazoutdoor'
    return img
  }
  logo.addTo(map)
}

export function createMap(container: HTMLElement): L.Map {
  // Logo puis zoom à droite : le panneau recouvre le coin haut gauche (sur grand écran), où Leaflet place le zoom par défaut
  const map = L.map(container, { zoomControl: false }).setView(VOSGES, ZOOM_INITIAL)
  addLogo(map)
  L.control.zoom({ position: 'topright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(map)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  addLegend(map)
  return map
}

export function showUserPosition(map: L.Map, position: Coordinates): void {
  const latLng: L.LatLngTuple = [position.lat, position.lng]
  L.circleMarker(latLng, { radius: 8, className: 'user-dot', fillOpacity: 0.8 })
    .bindTooltip('Vous êtes ici')
    .addTo(map)
  map.setView(latLng, 13)
}

function placePopup(place: Place): HTMLElement {
  // Construit en DOM (textContent) : les noms viennent de sources externes
  const box = document.createElement('div')
  const title = document.createElement('strong')
  title.textContent = place.name
  box.append(title, document.createElement('br'), `${PLACE_CATEGORY_LABEL[place.category]} · ${place.source}`)
  if (place.url?.startsWith('https://')) {
    const link = document.createElement('a')
    link.href = place.url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = 'Voir la fiche'
    box.append(document.createElement('br'), link)
  }
  return box
}

function protectedAreaPopup(area: ProtectedArea): HTMLElement {
  const box = document.createElement('div')
  box.className = 'od-popup'
  const title = document.createElement('strong')
  title.textContent = area.name
  box.append(title, document.createElement('br'), area.category)
  if (area.manager) box.append(document.createElement('br'), `Gestionnaire : ${area.manager}`)
  box.append(document.createElement('br'), 'Vérifiez la réglementation de la zone avant de partir (accès, chiens, bivouac, périodes de quiétude).')
  return box
}

export interface RouteLayers {
  show(route: Route, places: Place[], protectedAreas: ProtectedArea[]): void
  clear(): void
}

export function createRouteLayers(map: L.Map): RouteLayers {
  const layer = L.layerGroup().addTo(map)

  return {
    clear: () => layer.clearLayers(),
    show(route, places, protectedAreas) {
      layer.clearLayers()
      // Zones protégées d'abord : elles restent sous le tracé et les marqueurs
      for (const area of protectedAreas) {
        L.polygon(
          area.polygons.map((rings) => rings.map((ring) => ring.map((p): L.LatLngTuple => [p.lat, p.lng]))),
          { className: 'protected-area' },
        )
          .bindPopup(protectedAreaPopup(area))
          .addTo(layer)
      }
      const line = L.polyline(
        route.points.map((p): L.LatLngTuple => [p.lat, p.lng]),
        { className: 'route-line', weight: 5, opacity: 0.9 },
      ).addTo(layer)

      const start = route.points[0]
      L.marker([start.lat, start.lng], {
        icon: markerIcon(START_STYLE, 'route'),
        title: START_STYLE.label,
        alt: START_STYLE.label,
        zIndexOffset: 1000,
      }).addTo(layer)

      for (const place of places) {
        const label = PLACE_CATEGORY_LABEL[place.category]
        L.marker([place.position.lat, place.position.lng], {
          icon: markerIcon(CATEGORY_STYLE[place.category], place.category),
          title: `${label} : ${place.name}`,
          alt: label,
        })
          .bindPopup(placePopup(place))
          .addTo(layer)
      }
      map.fitBounds(line.getBounds(), { padding: [40, 40] })
    },
  }
}

const relativeTime = new Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })

function relativeTimeLabel(date: Date): string {
  const diffMin = Math.round((date.getTime() - Date.now()) / 60_000)
  if (diffMin === 0) return 'à l’instant'
  if (Math.abs(diffMin) < 60) return relativeTime.format(diffMin, 'minute')
  const diffHour = Math.round(diffMin / 60)
  if (Math.abs(diffHour) < 24) return relativeTime.format(diffHour, 'hour')
  return relativeTime.format(Math.round(diffHour / 24), 'day')
}

/** Au-delà, la popup ne montre plus les commentaires : un bouton ouvre la conversation */
const MAX_INLINE_COMMENTS = 3

const GONE_VOTED_KEY = 'wazoutdoor:gone-voted'

/** Un appareil ne vote « plus là » qu'une fois par signalement (garde-fou léger : pas de compte dans le prototype) */
function hasVotedGone(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(GONE_VOTED_KEY) ?? '[]') as string[]).includes(id)
  } catch {
    return false
  }
}

function rememberGoneVote(id: string): void {
  try {
    const voted = JSON.parse(localStorage.getItem(GONE_VOTED_KEY) ?? '[]') as string[]
    localStorage.setItem(GONE_VOTED_KEY, JSON.stringify([...voted, id]))
  } catch {
    // Sans stockage local, le garde-fou ne joue pas : le vote compte quand même
  }
}

/** Actions de cycle de vie, fournies par l'application ; chacune renvoie le signalement à jour */
export interface SignalisationActions {
  confirm(signalisation: Signalisation): Promise<Signalisation>
  reportGone(signalisation: Signalisation): Promise<Signalisation>
  comment(signalisation: Signalisation, text: string): Promise<Signalisation>
}

function lifecycleButtons(
  signalisation: Signalisation,
  actions: SignalisationActions,
  onChanged: (updated: Signalisation) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'od-popup__actions'
  const message = document.createElement('p')
  message.className = 'od-popup__message'
  message.setAttribute('role', 'status')
  const make = (label: string, fullName: string, tone: 'ok' | 'closed', iconPath: string, run: () => Promise<Signalisation>, done: string) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `od-button od-popup__vote od-popup__vote--${tone}`
    button.setAttribute('aria-label', fullName)
    const glyph = odIcon(iconPath, 18)
    glyph.setAttribute('class', 'od-popup__vote-icon')
    const text = document.createElement('span')
    text.textContent = label
    button.append(glyph, text)
    button.addEventListener('click', async () => {
      row.querySelectorAll('button').forEach((b) => (b.disabled = true))
      try {
        const updated = await run()
        // La carte se redessine (la fenêtre se ferme) : le retour passe par le toast
        showToast(done)
        onChanged(updated)
      } catch (error) {
        message.textContent = `Impossible : ${error instanceof Error ? error.message : 'erreur réseau'}`
        row.querySelectorAll('button').forEach((b) => (b.disabled = false))
      }
    })
    return button
  }
  const still = make('Oui', 'Toujours là', 'ok', CHECK_ICON_PATH, () => actions.confirm(signalisation), 'Merci, signalement confirmé.')
  const gone = make(
    'Non',
    'Plus là',
    'closed',
    CLOSE_ICON_PATH,
    async () => {
      const updated = await actions.reportGone(signalisation)
      rememberGoneVote(signalisation.id)
      return updated
    },
    'Merci. Il disparaît quand deux personnes disent qu’il n’y est plus.',
  )
  const votes = document.createElement('div')
  votes.className = 'od-popup__votes'
  const question = document.createElement('p')
  question.className = 'od-popup__question'
  question.textContent = 'Toujours là ?'
  votes.append(still, gone)
  row.append(question, votes)
  if (hasVotedGone(signalisation.id)) {
    gone.disabled = true
    gone.setAttribute('aria-label', 'Plus là (vote enregistré)')
    gone.title = 'Vote enregistré'
  }
  const total = signalisation.comments?.length ?? 0
  const talk = document.createElement('button')
  talk.type = 'button'
  talk.className = 'od-button od-button--secondary od-popup__action od-popup__talk'
  talk.textContent = total > MAX_INLINE_COMMENTS ? `Voir la conversation (${total})` : 'Ajouter un commentaire'
  talk.addEventListener('click', () => openCommentsDialog(signalisation, actions.comment, onChanged))
  row.append(talk, message)
  return row
}

function signalisationPopup(
  signalisation: Signalisation,
  toConfirm: boolean,
  actions?: SignalisationActions,
  onChanged: (updated: Signalisation) => void = () => {},
): HTMLElement {
  const box = document.createElement('div')
  box.className = 'od-popup'
  const title = document.createElement('strong')
  title.textContent = SIGNALISATION_TYPE_LABEL[signalisation.type]
  box.append(title)
  if (signalisation.description) box.append(document.createElement('br'), signalisation.description)
  box.append(document.createElement('br'), `Signalé ${relativeTimeLabel(signalisation.createdAt)}${toConfirm ? ' · à confirmer' : ''}`)
  if (isGonePending(signalisation)) box.append(document.createElement('br'), 'Une personne dit qu’il n’y est plus : à confirmer.')
  const photoUrl = signalisation.photoUrl
  if (isDisplayablePhoto(photoUrl)) {
    const thumb = document.createElement('button')
    thumb.type = 'button'
    thumb.className = 'od-popup__thumb'
    thumb.setAttribute('aria-label', 'Agrandir la photo du signalement')
    const img = document.createElement('img')
    img.src = photoUrl
    img.alt = 'Photo du signalement'
    img.loading = 'lazy'
    thumb.append(img)
    thumb.addEventListener('click', () => openPhotoViewer(photoUrl, `Photo : ${SIGNALISATION_TYPE_LABEL[signalisation.type]}`))
    box.append(thumb)
  }
  if (signalisation.comments?.length && signalisation.comments.length <= MAX_INLINE_COMMENTS) {
    const list = document.createElement('ul')
    list.className = 'od-popup__comments'
    for (const comment of signalisation.comments) {
      const item = document.createElement('li')
      item.textContent = comment
      list.append(item)
    }
    box.append(list)
  }
  if (actions) box.append(lifecycleButtons(signalisation, actions, onChanged))
  return box
}

export interface SignalisationLayer {
  show(signalisations: Signalisation[]): void
  add(signalisation: Signalisation): void
  /** Remplace un signalement modifié (même identifiant) */
  replace(signalisation: Signalisation): void
  /** Centre la carte sur le signalement et ouvre sa fenêtre (sauf `openPopup: false`) */
  focus(signalisation: Signalisation, options?: { openPopup?: boolean }): void
  /** Types réglés sur « Red flag » par l'utilisateur·rice : leurs points émettent une onde rouge */
  setRedFlags(types: ReadonlySet<SignalisationType>): void
}

// Deux pastilles plus proches que cela (en pixels) se chevauchent : on les écarte
const PIN_OVERLAP_PX = 40
const PIN_SPACING_PX = 46

/**
 * Position d'affichage de chaque signalement : les pastilles qui se superposent à l'échelle actuelle sont disposées
 * en cercle autour de leur centroïde. Seul l'affichage bouge, les positions signalées ne changent pas.
 */
function spreadOverlapping(map: L.Map, signalisations: Signalisation[]): L.LatLng[] {
  const zoom = map.getZoom()
  const points = signalisations.map((s) => map.project([s.position.lat, s.position.lng], zoom))
  const groups: number[][] = []
  points.forEach((point, index) => {
    const group = groups.find((members) => members.some((m) => points[m].distanceTo(point) < PIN_OVERLAP_PX))
    if (group) group.push(index)
    else groups.push([index])
  })

  const placed: L.LatLng[] = []
  for (const members of groups) {
    const centerX = members.reduce((sum, m) => sum + points[m].x, 0) / members.length
    const centerY = members.reduce((sum, m) => sum + points[m].y, 0) / members.length
    if (members.length === 1) {
      placed[members[0]] = map.unproject(points[members[0]], zoom)
      continue
    }
    // Rayon pour que deux pastilles voisines restent à PIN_SPACING_PX l'une de l'autre ; la première est en haut
    const radius = PIN_SPACING_PX / (2 * Math.sin(Math.PI / members.length))
    members.forEach((m, rank) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * rank) / members.length
      placed[m] = map.unproject(L.point(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle)), zoom)
    })
  }
  return placed
}

export function createSignalisationLayer(map: L.Map, actions?: SignalisationActions): SignalisationLayer {
  const layer = L.layerGroup().addTo(map)
  let signalisations: Signalisation[] = []
  let redFlags: ReadonlySet<SignalisationType> = new Set()

  const markerFor = (signalisation: Signalisation, position: L.LatLng) => {
    const label = SIGNALISATION_TYPE_LABEL[signalisation.type]
    const toConfirm = signalisationStatus(signalisation, new Date()) === 'to_confirm'
    return L.marker(position, {
      icon: dangerPinIcon(signalisation, redFlags.has(signalisation.type), toConfirm),
      title: label,
      alt: label,
    }).bindPopup(signalisationPopup(signalisation, toConfirm, actions, (updated) => api.replace(updated)))
  }

  const markers = new Map<string, L.Marker>()

  const render = () => {
    layer.clearLayers()
    markers.clear()
    // Un signalement résolu ou expiré en cours de session disparaît de la carte
    const live = signalisations.filter((s) => isLive(s, new Date()))
    const positions = spreadOverlapping(map, live)
    live.forEach((signalisation, index) => {
      const marker = markerFor(signalisation, positions[index]).addTo(layer)
      markers.set(signalisation.id, marker)
    })
  }
  // À chaque zoom, des pastilles se rapprochent ou s'éloignent
  map.on('zoomend', render)

  const api: SignalisationLayer = {
    show(next) {
      signalisations = next
      render()
    },
    add(signalisation) {
      signalisations = [...signalisations, signalisation]
      render()
    },
    replace(signalisation) {
      signalisations = signalisations.map((s) => (s.id === signalisation.id ? signalisation : s))
      render()
    },
    focus(signalisation, options) {
      // Le zoom relance le rendu (zoomend) : on rouvre la fenêtre sur le marqueur recréé une fois la carte arrivée
      if (options?.openPopup !== false) map.once('moveend', () => markers.get(signalisation.id)?.openPopup())
      map.setView([signalisation.position.lat, signalisation.position.lng], Math.max(map.getZoom(), 16))
    },
    setRedFlags(types) {
      redFlags = types
      render()
    },
  }
  return api
}
