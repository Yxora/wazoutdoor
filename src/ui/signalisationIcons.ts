import type { SignalisationType } from '../domain/signalisation'

// Glyphes SVG statiques (viewBox 24, trait 2px, bouts arrondis) : langage iconographique du chart WazeOutdoor.
export const TYPE_ICON_PATH: Record<SignalisationType, string> = {
  eboulis: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.01"/>',
  arbre: '<path d="M12 21v-7M12 14l-5-1 3-4-3-1 5-6 5 6-3 1 3 4z"/>',
  boue: '<path d="M3 10c3-3 6 3 9 0s6 3 9 0M3 16c3-3 6 3 9 0s6 3 9 0"/>',
  neige: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>',
  eau: '<path d="M12 3s6 6.2 6 10.5A6 6 0 0 1 6 13.5C6 9.2 12 3 12 3z"/>',
  chasse:
    '<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 1.8v3.2M12 19v3.2M1.8 12h3.2M19 12h3.2"/>',
  troupeau:
    '<circle cx="7" cy="9" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="6.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r="1.5" fill="currentColor" stroke="none"/><path d="M12 11c-3 0-5 3-5 5.5 0 1.5 1.3 2 2.5 1.5l2.5-.8 2.5.8c1.2.5 2.5 0 2.5-1.5C17 14 15 11 12 11z"/>',
  incendie: '<path d="M12 21a6 6 0 0 0 6-6c0-3-2-5-3-7-.5 2-2 3-2 5a2 2 0 0 1-4 0c0-3 2-5 1-8-3 2-4 6-4 10a6 6 0 0 0 6 6z"/>',
  balisage: '<path d="M6 21V4M6 5h11l-2 4 2 4H6"/>',
  brouillard: '<path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.3A3.4 3.4 0 0 1 17 15z"/><path d="M6 19h12"/>',
  dechets: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  autre:
    '<circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
}

/** Forme de statut « attention » : un signalement est par nature un point à surveiller. */
export const WARNING_ICON_PATH = TYPE_ICON_PATH.eboulis

/** Forme de statut « bloquant » (octogone barré) : danger grave, jamais distingué par la seule couleur. */
export const CLOSED_STATUS_ICON_PATH = '<path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7L8.5 3z"/><path d="M6.5 6.5l11 11"/>'

/** Forme de statut « praticable » : cercle avec coche. */
export const OK_STATUS_ICON_PATH = '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>'

/** Forme de statut « pas d'info » : cercle en pointillés avec « ? ». */
export const UNKNOWN_STATUS_ICON_PATH =
  '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/><path d="M9.7 9.6a2.4 2.4 0 0 1 4.6.8c0 1.6-2.3 1.9-2.3 3.4M12 16.8v.01"/>'

export const PLUS_ICON_PATH = '<path d="M12 5v14M5 12h14"/>'
export const CLOSE_ICON_PATH = '<path d="M6 6l12 12M18 6L6 18"/>'
export const LOCATION_ICON_PATH = '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'

/** Icône trait 2px, 24px, bouts arrondis — jamais d'emoji (règle du chart). */
export function odIcon(pathD: string, size = 24): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  // Contenu statique défini dans ce fichier, jamais issu d'une source externe
  svg.innerHTML = pathD
  return svg
}

/** Icônes du menu du bas : tracé et réglages */
export const ROUTE_ICON_PATH = '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>'
export const VERIFY_ICON_PATH = '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'
export const SLIDERS_ICON_PATH = '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'

/** Icônes d'activité des itinéraires importés */
export const BIKE_ICON_PATH = '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-8h5l3 8M10 8l3 8M9 6h3"/>'
export const RUN_ICON_PATH = '<circle cx="14" cy="4.5" r="1.8"/><path d="M12 9l-3 3 3 2-2 6M12 9l4 2 3-1M12 14l3 2v4"/>'
export const MOUNTAIN_ICON_PATH = '<path d="M3 20l6-11 4 6 3-4 5 9z"/>'
