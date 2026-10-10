import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '../domain/coordinates'
import { PLACE_CATEGORY_LABEL, type Place, type PlaceCategory } from '../domain/place'
import type { Route } from '../domain/route'
import { isCritical, SIGNALISATION_TYPE_LABEL, type Signalisation, type SignalisationType } from '../domain/signalisation'
import { pictoIcon } from './pictos'
import { CLOSED_STATUS_ICON_PATH, odIcon, WARNING_ICON_PATH } from './signalisationIcons'
import logoUrl from './assets/logo.svg'
import { SIGNALISATION_TYPE_LABEL, type Signalisation } from '../domain/signalisation'
import { odIcon, WARNING_ICON_PATH } from './signalisationIcons'

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

/** Pastille « danger signalé » : forme de statut (triangle), jamais la couleur seule. Chart WazeOutdoor. */
function dangerPinBadge(legend = false): HTMLElement {
/**
 * Pastille « danger signalé » : le picto dit quoi (planche des pictos d'imprévus), la gravité reste portée par une forme de statut
 * en coin, jamais par la couleur seule. Attention (triangle, orange) pour la plupart des signalements, bloquant (octogone barré,
 * rouge) pour les dangers graves (ex. feu de forêt). Chart WazeOutdoor.
 */
function dangerPinBadge(type: SignalisationType, legend = false, redFlag = false): HTMLElement {
  const critical = isCritical(type)
  const element = document.createElement('span')
  element.className = legend ? 'od-pin od-pin--legend' : 'od-pin'
  element.append(odIcon(WARNING_ICON_PATH, legend ? 16 : 20))
  const modifier = critical ? 'od-pin--critical' : ''
  const wave = redFlag ? 'od-pin--redflag' : ''
  element.className = [legend ? 'od-pin od-pin--legend' : 'od-pin', modifier, wave].filter(Boolean).join(' ')
  const status = document.createElement('span')
  status.className = 'od-pin__status'
  status.append(odIcon(critical ? CLOSED_STATUS_ICON_PATH : WARNING_ICON_PATH, legend ? 10 : 14))
  element.append(pictoIcon(type, legend ? 20 : 28), status)
  return element
}

function dangerPinIcon(): L.DivIcon {
function dangerPinIcon(signalisation: Signalisation, redFlag: boolean): L.DivIcon {
  return L.divIcon({
    html: dangerPinBadge(),
    html: dangerPinBadge(signalisation.type, false, redFlag),
    className: 'map-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

function markerIcon(style: MarkerStyle): L.DivIcon {
  return L.divIcon({
    html: badge(style),
    className: 'map-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

function legendRow(symbol: HTMLElement, label: string): HTMLElement {
  const row = document.createElement('li')
  row.className = 'map-legend__row'
  row.append(symbol, label)
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

    const list = document.createElement('ul')
    list.className = 'map-legend__list'
    list.append(
      legendRow(line, 'Tracé'),
      legendRow(badge(START_STYLE), START_STYLE.label),
      ...LEGEND_CATEGORIES.map((category) => legendRow(badge(CATEGORY_STYLE[category]), CATEGORY_STYLE[category].label)),
      legendRow(dot, 'Votre position'),
      legendRow(dangerPinBadge('arbre', true), 'Danger signalé (le picto dit lequel)'),
      legendRow(dangerPinBadge('incendie', true), 'Danger grave (ex. feu de forêt)'),
      legendRow(dangerPinBadge(true), 'Danger signalé'),
    )

    box.append(summary, list)
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

export interface RouteLayers {
  show(route: Route, places: Place[]): void
  clear(): void
}

export function createRouteLayers(map: L.Map): RouteLayers {
  const layer = L.layerGroup().addTo(map)

  return {
    clear: () => layer.clearLayers(),
    show(route, places) {
      layer.clearLayers()
      const line = L.polyline(
        route.points.map((p): L.LatLngTuple => [p.lat, p.lng]),
        { className: 'route-line', weight: 5, opacity: 0.9 },
      ).addTo(layer)

      const start = route.points[0]
      L.marker([start.lat, start.lng], {
        icon: markerIcon(START_STYLE),
        title: START_STYLE.label,
        alt: START_STYLE.label,
        zIndexOffset: 1000,
      }).addTo(layer)

      for (const place of places) {
        const label = PLACE_CATEGORY_LABEL[place.category]
        L.marker([place.position.lat, place.position.lng], {
          icon: markerIcon(CATEGORY_STYLE[place.category]),
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

function signalisationPopup(signalisation: Signalisation): HTMLElement {
  const box = document.createElement('div')
  box.className = 'od-popup'
  const title = document.createElement('strong')
  title.textContent = SIGNALISATION_TYPE_LABEL[signalisation.type]
  box.append(title)
  if (signalisation.description) box.append(document.createElement('br'), signalisation.description)
  box.append(document.createElement('br'), `Signalé ${relativeTimeLabel(signalisation.createdAt)}`)
  return box
}

export interface SignalisationLayer {
  show(signalisations: Signalisation[]): void
  add(signalisation: Signalisation): void
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

export function createSignalisationLayer(map: L.Map): SignalisationLayer {
  const layer = L.layerGroup().addTo(map)
  let signalisations: Signalisation[] = []
  let redFlags: ReadonlySet<SignalisationType> = new Set()

  const markerFor = (signalisation: Signalisation, position: L.LatLng) => {
    const label = SIGNALISATION_TYPE_LABEL[signalisation.type]
    return L.marker([signalisation.position.lat, signalisation.position.lng], {
      icon: dangerPinIcon(),
    return L.marker(position, {
      icon: dangerPinIcon(signalisation, redFlags.has(signalisation.type)),
      title: label,
      alt: label,
    }).bindPopup(signalisationPopup(signalisation))
  }

  const render = () => {
    layer.clearLayers()
    const positions = spreadOverlapping(map, signalisations)
    signalisations.forEach((signalisation, index) => markerFor(signalisation, positions[index]).addTo(layer))
  }
  // À chaque zoom, des pastilles se rapprochent ou s'éloignent
  map.on('zoomend', render)

  return {
    show(next) {
      signalisations = next
      render()
    },
    add(signalisation) {
      signalisations = [...signalisations, signalisation]
      render()
    },
    setRedFlags(types) {
      redFlags = types
      render()
    },
  }
}
