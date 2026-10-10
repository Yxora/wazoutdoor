import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '../domain/coordinates'
import { PLACE_CATEGORY_LABEL, type Place, type PlaceCategory } from '../domain/place'
import type { Route } from '../domain/route'

// Centre des Vosges, cible de départ du projet
const VOSGES: L.LatLngTuple = [48.0, 7.0]
const ZOOM_INITIAL = 9

const ROUTE_COLOR = '#c2185b'
const USER_COLOR = '#1a73e8'

// Glyphes SVG statiques (viewBox 24). Chaque catégorie a une couleur ET un dessin différents :
// la couleur ne doit pas être le seul moyen de distinguer les lieux.
const GLYPH = {
  drop: '<path d="M12 3.5c-3 4-6 7.3-6 10.6a6 6 0 0 0 12 0c0-3.3-3-6.6-6-10.6z"/>',
  tent: '<path fill-rule="evenodd" d="M12 4 2.5 19h19L12 4zm0 7 3.6 6H8.4L12 11z"/>',
  house: '<path d="M12 3.5 2.5 12H5v7.5h5v-5h4v5h5V12h2.5L12 3.5z"/>',
  bed: '<path d="M3 6h2v9h14v-3.5C19 9.6 17.4 8 15.5 8H10v5H5V6z"/><path d="M3 15h18v3H3z"/>',
  flag: '<path d="M6 3h2v18H6V3zm2 1h10l-2.5 4 2.5 4H8V4z"/>',
} as const

interface MarkerStyle {
  label: string
  color: string
  glyph: string
}

const START_STYLE: MarkerStyle = { label: 'Départ du tracé', color: '#1c2420', glyph: GLYPH.flag }

const CATEGORY_STYLE: Record<PlaceCategory, MarkerStyle> = {
  water: { label: PLACE_CATEGORY_LABEL.water, color: '#1d70b8', glyph: GLYPH.drop },
  hut: { label: PLACE_CATEGORY_LABEL.hut, color: '#a34a08', glyph: GLYPH.tent },
  refuge: { label: PLACE_CATEGORY_LABEL.refuge, color: '#6a3d9a', glyph: GLYPH.house },
  lodge: { label: PLACE_CATEGORY_LABEL.lodge, color: '#1e7b43', glyph: GLYPH.bed },
}

const LEGEND_CATEGORIES: PlaceCategory[] = ['water', 'hut', 'refuge', 'lodge']

/** Pastille ronde colorée contenant un glyphe. Même rendu sur la carte et dans la légende. */
function badge(style: MarkerStyle): HTMLElement {
  const element = document.createElement('span')
  element.className = 'map-badge'
  element.style.background = style.color
  // Contenu statique défini dans ce fichier, jamais issu d'une source externe
  element.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" fill="currentColor">${style.glyph}</svg>`
  return element
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
  const legend = new L.Control({ position: 'topright' })

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
    line.style.background = ROUTE_COLOR

    const dot = document.createElement('span')
    dot.className = 'map-legend__dot'
    dot.style.background = USER_COLOR

    const list = document.createElement('ul')
    list.className = 'map-legend__list'
    list.append(
      legendRow(line, 'Tracé'),
      legendRow(badge(START_STYLE), START_STYLE.label),
      ...LEGEND_CATEGORIES.map((category) => legendRow(badge(CATEGORY_STYLE[category]), CATEGORY_STYLE[category].label)),
      legendRow(dot, 'Votre position'),
    )

    box.append(summary, list)
    return box
  }

  legend.addTo(map)
}

export function createMap(container: HTMLElement): L.Map {
  const map = L.map(container).setView(VOSGES, ZOOM_INITIAL)

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)

  addLegend(map)
  return map
}

export function showUserPosition(map: L.Map, position: Coordinates): void {
  const latLng: L.LatLngTuple = [position.lat, position.lng]
  L.circleMarker(latLng, { radius: 8, color: USER_COLOR, fillColor: USER_COLOR, fillOpacity: 0.8 })
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
        { color: ROUTE_COLOR, weight: 5, opacity: 0.85 },
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
