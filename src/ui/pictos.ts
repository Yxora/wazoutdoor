import type { SignalisationType } from '../domain/signalisation'

// Pictos d'imprévus en deux tons (grille 48, trait 2,5), redessinés d'après guidelines/planche-pictos-imprevus.webp.
// Les remplissages viennent des variables --od-picto-* de tokens.css. Le picto dit « quoi » ; la gravité reste portée par les formes de statut.
const fill = (name: string) => `style="fill:var(--od-picto-${name})"`
const WHITE = 'style="fill:#fff"'
const INK = 'style="fill:var(--od-ink);stroke:none"'

const CHASSE =
  `<rect x="5" y="5" width="38" height="27" rx="4" ${fill('blaze')}/><path d="M24 32v10M15 42h18"/>` +
  `<path d="M14 11l5 6M34 11l-5 6M14 11v6M34 11v6M19 17h10l-2 10h-6z" ${fill('sun')}/>` +
  `<circle cx="22" cy="21" r="1" ${INK}/><circle cx="26" cy="21" r="1" ${INK}/>`

const TERRAIN =
  `<path d="M5 41l9-22h10l9 22z" ${fill('earth')}/><path d="M9 33c4-3 8 3 12 0s6 2 8 0"/>` +
  `<circle cx="35" cy="32" r="8" ${fill('sky')}/><path d="M35 26v12M29.8 29l10.4 6M40.2 29l-10.4 6"/>`

const TROUPEAU =
  `<path d="M13 15c-6 1-7 11-3 17M35 15c6 1 7 11 3 17" ${fill('earth')}/>` +
  `<path d="M24 8c-8 0-13 6-13 14 0 9 6 16 13 16s13-7 13-16c0-8-5-14-13-14z" ${WHITE}/>` +
  `<circle cx="19" cy="22" r="1.6" ${INK}/><circle cx="29" cy="22" r="1.6" ${INK}/>` +
  `<path d="M21 28h6l-3 3zM24 31v3M20 35c2 2 6 2 8 0"/>`

const CRUE =
  `<path d="M33 6v22M33 11h5M33 17h5M33 23h5"/>` +
  `<path d="M5 27c4-4 8 4 12 0s8 4 12 0 8 4 14 0v14H5z" ${fill('water')}/><path d="M5 34c4-3 8 3 12 0s8 3 12 0 8 3 14 0"/>`

const INCENDIE =
  `<path d="M24 5c1 9 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 6-13 0 3 1 5 3 5-1-6-1-11 3-16z" ${fill('blaze')}/>` +
  `<path d="M24 42a6 6 0 0 1-6-6c0-4 3-6 6-10 3 4 6 6 6 10a6 6 0 0 1-6 6z" ${fill('sun')}/>`

const EBOULIS =
  `<path d="M5 41L21 13l16 28z" ${fill('rock')}/><path d="M17 41l4-9 4 9" fill="none"/>` +
  `<path d="M31 9l6-3 5 5-2 6-7-1z" ${fill('earth')}/>`

const BALISAGE =
  `<path d="M6 12v26"/><path d="M6 12h24l4 5-4 5H6z" ${fill('earth')}/>` +
  `<path d="M22 27l17 5-1.5 5-17-5z" ${fill('earth')}/><path d="M26 6l2 4M32 5l-1 4"/>` +
  `<path d="M5 43c4-3 8 3 12 0s8 3 12 0 8 3 14 0" ${fill('water')}/>`

const DECHETS =
  `<path d="M7 30c0-9 6-16 12-16s12 7 12 16v8a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z" ${fill('earth')}/>` +
  `<path d="M15 14l-2-5M23 14l2-5"/>` +
  `<rect x="35" y="22" width="8" height="20" rx="2" ${WHITE}/><rect x="36.5" y="13" width="5" height="9" rx="1" ${fill('blaze')}/>`

const ARBRE =
  `<circle cx="30" cy="16" r="9" ${fill('leaf')}/>` +
  `<path d="M5 24h9v18H5z" ${fill('earth')}/><path d="M14 30l27 8-2 5-25-6z" ${fill('earth')}/>`

const BROUILLARD =
  `<path d="M5 24l9-14 9 14z" ${fill('leaf')}/><path d="M19 24l9-13 9 13z" ${fill('rock')}/>` +
  `<rect x="5" y="27" width="30" height="6" rx="3" ${fill('sky')}/><rect x="13" y="36" width="30" height="6" rx="3" ${fill('sky')}/>`

const AUTRE =
  `<path d="M8 7h32a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H22l-8 8v-8H8a3 3 0 0 1-3-3V10a3 3 0 0 1 3-3z" ${fill('sky')}/>` +
  `<circle cx="15" cy="20" r="2.5" ${INK}/><circle cx="24" cy="20" r="2.5" ${INK}/><circle cx="33" cy="20" r="2.5" ${INK}/>`

/** Contenu SVG statique (jamais issu d'une source externe) de chaque type de signalement */
export const PICTO: Record<SignalisationType, string> = {
  chasse: CHASSE,
  boue: TERRAIN,
  neige: TERRAIN,
  troupeau: TROUPEAU,
  eau: CRUE,
  incendie: INCENDIE,
  eboulis: EBOULIS,
  balisage: BALISAGE,
  dechets: DECHETS,
  arbre: ARBRE,
  brouillard: BROUILLARD,
  autre: AUTRE,
}

export function pictoIcon(type: SignalisationType, size: number): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 48 48')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'var(--od-ink)')
  svg.setAttribute('stroke-width', '2.5')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.innerHTML = PICTO[type]
  return svg
}
