import type { Evaluation } from '../application/evaluateRoute'
import { MODE_LABEL, type Profile } from '../domain/profile'
import { formatDuration, type CriterionResult, type CriterionStatus, type Facet, type Verdict } from '../domain/serenity'
import { el, type Child } from './dom'
import { CLOSED_STATUS_ICON_PATH, CLOSE_ICON_PATH, INFO_ICON_PATH, odIcon, OK_STATUS_ICON_PATH, UNKNOWN_STATUS_ICON_PATH, WARNING_ICON_PATH } from './signalisationIcons'

export interface ResultView {
  routeName: string
  profile: Profile
  start: Date
  evaluation: Evaluation
  /** Sans compte : le score suit les critères standards, pas des préférences personnelles */
  standardCriteria: boolean
}

export interface ScoreView {
  /** Affiche (ou met à jour) le score en bas de la carte et le détail dans la modale */
  show(view: ResultView): void
  /** Ferme la modale de détail */
  closeDetail(): void
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  serene: 'Sortie sereine',
  caution: 'À préparer avec attention',
  alert: 'Plusieurs points d’alerte',
}

// Le statut n'est jamais porté par la couleur seule : une forme, un libellé, une couleur (chart WazeOutdoor)
const STATUS_ICON_PATH: Record<CriterionStatus, string> = {
  ok: OK_STATUS_ICON_PATH,
  warning: WARNING_ICON_PATH,
  alert: CLOSED_STATUS_ICON_PATH,
  unknown: UNKNOWN_STATUS_ICON_PATH,
}
const STATUS_TEXT: Record<CriterionStatus, string> = {
  ok: 'Favorable',
  warning: 'À surveiller',
  alert: 'Point d’alerte',
  unknown: 'Donnée indisponible',
}

// Les points bloquants d'abord, puis ceux qui limitent, puis les favorables ; indisponibles et ignorés en dernier
const STATUS_ORDER: Record<CriterionStatus, number> = { alert: 0, warning: 1, ok: 2, unknown: 3 }

function displayRank(criterion: CriterionResult): number {
  return criterion.mode === 'ignore' ? 4 : STATUS_ORDER[criterion.status]
}

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function criterionCard(criterion: CriterionResult): HTMLElement {
  if (criterion.mode === 'ignore') {
    return el(
      'li',
      { className: 'criterion criterion--ignored' },
      el('div', { className: 'criterion__head' }, el('strong', {}, criterion.label), el('span', { className: 'criterion__status' }, 'Ignoré selon vos préférences')),
    )
  }
  const meta = [criterion.source]
  if (criterion.updatedAt) meta.push(`mis à jour le ${dateTimeFormat.format(criterion.updatedAt)}`)

  // Carte repliée : titre et score. Un clic déplie le détail (statut, explication, éléments, source).
  const score = criterion.score === null ? 'n.d.' : `${criterion.score}/100`
  const summary = el(
    'summary',
    { className: 'criterion__head' },
    el('span', { className: 'criterion__icon' }, odIcon(STATUS_ICON_PATH[criterion.status], 20)),
    el('strong', {}, criterion.label),
    criterion.mode === 'veto' ? el('span', { className: 'criterion__mode' }, MODE_LABEL.veto) : '',
    el('span', { className: 'criterion__score' }, score),
  )
  summary.setAttribute('aria-label', `${criterion.label}, ${STATUS_TEXT[criterion.status]}, ${criterion.score === null ? 'score indisponible' : `${criterion.score} sur 100`}`)

  return el(
    'li',
    { className: `criterion criterion--${criterion.status}` },
    el(
      'details',
      { className: 'criterion__details' },
      summary,
      el(
        'div',
        { className: 'criterion__body' },
        el('p', { className: 'criterion__status' }, STATUS_TEXT[criterion.status]),
        el('p', { className: 'criterion__detail' }, criterion.detail),
        criterion.facets ? facetList(criterion.facets) : '',
        el('p', { className: 'criterion__source' }, `Source : ${meta.join(' · ')}`),
      ),
    ),
  )
}

function facetList(facets: Facet[]): HTMLElement {
  return el(
    'ul',
    { className: 'facets' },
    ...facets.map((facet) =>
      el(
        'li',
        { className: `facet facet--${facet.status}` },
        el('span', { className: 'facet__icon' }, odIcon(STATUS_ICON_PATH[facet.status], 20)),
        el('strong', {}, `${facet.label} : `),
        facet.detail,
      ),
    ),
  )
}

const RING_RADIUS = 42
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/** Remplit l'anneau à `percent` % (arc et chiffre au centre). Sert aussi à l'animation d'apparition du score. */
export function setScoreRingProgress(ring: HTMLElement, percent: number): void {
  const ratio = Math.min(1, Math.max(0, percent / 100))
  ring.querySelector('.score-ring__arc')?.setAttribute('stroke-dasharray', `${(RING_CIRCUMFERENCE * ratio).toFixed(2)} ${RING_CIRCUMFERENCE.toFixed(2)}`)
  const label = ring.querySelector('.score-ring__label')
  if (label) label.textContent = `${Math.round(percent)}%`
}

/** Score en anneau de 0 à 100 %, le pourcentage au centre. La couleur vient du statut du verdict (--od-s), le chiffre dit la même chose. */
export function scoreRing(total: number | null, size: number): HTMLElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  svg.innerHTML =
    `<circle class="score-ring__track" cx="50" cy="50" r="${RING_RADIUS}" fill="none" stroke-width="10"/>` +
    `<circle class="score-ring__arc" cx="50" cy="50" r="${RING_RADIUS}" fill="none" stroke-width="10" stroke-linecap="round" transform="rotate(-90 50 50)"/>`
  const ring = el('span', { className: 'score-ring' }, svg, el('span', { className: 'score-ring__label' }))
  ring.style.width = ring.style.height = `${size}px`
  ring.setAttribute('role', 'img')
  ring.setAttribute('aria-label', total === null ? 'Score indisponible' : `Score : ${total} pour cent`)
  setScoreRingProgress(ring, total ?? 0)
  if (total === null) ring.querySelector('.score-ring__label')!.textContent = '–'
  return ring
}

function scoreBadge({ score }: Evaluation): HTMLElement {
  if (score.total === null || score.verdict === null) {
    return el(
      'p',
      { className: 'error' },
      score.totalCriteria === 0
        ? 'Tous les critères sont ignorés : aucun score à calculer. Modifiez vos préférences.'
        : 'Aucun critère n’a pu être calculé.',
    )
  }
  return el(
    'div',
    { className: `score score--${score.verdict}` },
    scoreRing(score.total, 180),
    el('span', { className: 'score__verdict' }, VERDICT_LABEL[score.verdict]),
  )
}

function statBox(label: string, value: string, notes: string[] = []): HTMLElement {
  return el(
    'div',
    { className: 'stat' },
    el('span', { className: 'stat__label' }, label),
    el('strong', { className: 'stat__value' }, value),
    ...notes.map((note) => el('span', { className: 'stat__note' }, note)),
  )
}

interface Note {
  title: string
  status: CriterionStatus
  text: string
}

/** Fenêtre « Notes sur les résultats » : score mis à 0, score partiel, estimation de la durée, avertissement */
function openNotesDialog(notes: Note[]): void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const overlay = el('div', { className: 'info-dialog' })
  const close = () => {
    document.removeEventListener('keydown', onKeydown)
    overlay.remove()
    if (opener?.isConnected) opener.focus()
  }
  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close()
  }
  const closeButton = el('button', { type: 'button', className: 'od-sheet__close' })
  closeButton.setAttribute('aria-label', 'Fermer')
  const closeIcon = odIcon(CLOSE_ICON_PATH, 18)
  closeIcon.setAttribute('class', 'od-sheet__close-icon')
  closeButton.append(closeIcon)
  closeButton.addEventListener('click', close)

  const box = el(
    'div',
    { className: 'info-dialog__box' },
    el('div', { className: 'info-dialog__header' }, el('h2', { className: 'od-sheet__title', id: 'notes-title' }, 'Notes sur les résultats'), closeButton),
    el(
      'div',
      { className: 'info-dialog__content' },
      ...notes.map((note) =>
        el(
          'section',
          { className: `note note--${note.status}` },
          el('h3', { className: 'note__title' }, el('span', { className: `criterion__icon criterion--${note.status}` }, odIcon(STATUS_ICON_PATH[note.status], 18)), note.title),
          el('p', { className: 'note__text' }, note.text),
        ),
      ),
    ),
  )
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-labelledby', 'notes-title')
  overlay.append(box)
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close()
  })
  document.addEventListener('keydown', onKeydown)
  document.body.append(overlay)
  closeButton.focus()
}

/** Bouton « info » en haut à droite du détail : ouvre la fenêtre des notes */
function infoButton(notes: Note[]): HTMLElement {
  const button = el('button', { type: 'button', className: 'info-button' })
  button.setAttribute('aria-label', 'Notes sur les résultats')
  button.setAttribute('aria-haspopup', 'dialog')
  button.title = 'Notes sur les résultats'
  button.append(odIcon(INFO_ICON_PATH, 22))
  button.addEventListener('click', () => openNotesDialog(notes))
  return button
}

/** Sans compte : dire que le score suit les critères standards, et proposer de se connecter pour les régler */
function standardNotice(onSignIn: () => void): HTMLElement {
  const button = el('button', { type: 'button', className: 'standard-notice__link' }, 'Se connecter pour les régler')
  button.addEventListener('click', onSignIn)
  return el('p', { className: 'standard-notice' }, 'Score calculé avec les critères standards. ', button)
}

function detailContent({ routeName, profile, start, evaluation, standardCriteria }: ResultView, onSignIn: () => void): Child[] {
  const { summary, score } = evaluation
  const ascent = summary.ascentM === null ? 'n.d.' : `+${Math.round(summary.ascentM)} m`
  // Vitesse moyenne réellement retenue (distance / durée estimée), à côté des hypothèses du profil
  const averageKmh = summary.movingMin > 0 ? (summary.distanceKm / (summary.movingMin / 60)).toFixed(1).replace('.', ',') : null

  const vetoed = score.criteria.find((c) => c.id === score.vetoedBy)
  const notes: Note[] = []
  if (vetoed) {
    notes.push({
      title: 'Score mis à 0',
      status: 'alert',
      text: vetoed.redFlag
        ? `« ${vetoed.redFlag} » est signalé sur votre parcours et vous l’avez réglé sur « ${MODE_LABEL.veto} ».`
        : `« ${vetoed.label} » est en alerte et vous l’avez réglé sur « ${MODE_LABEL.veto} ».`,
    })
  }
  if (score.availableCriteria < score.totalCriteria) {
    notes.push({
      title: `Score partiel : ${score.availableCriteria} critère(s) sur ${score.totalCriteria}`,
      status: 'warning',
      text: 'Les critères indisponibles ne sont pas comptés comme favorables : ils sont exclus du calcul.',
    })
  }
  notes.push(
    {
      title: 'Comment la durée est estimée',
      status: 'unknown',
      text: `${profile.flatSpeedKmh} km/h à plat + ${profile.climbMetersPerHour} m de montée par heure (profil ${profile.label.toLowerCase()}), plus ${formatDuration(summary.breakMin)} de pause. La vitesse moyenne affichée est calculée sans la pause. Ce sont des hypothèses, pas des valeurs validées.`,
    },
    {
      title: 'À prendre avec du recul',
      status: 'unknown',
      text: 'Ce score aide à préparer une sortie, il ne garantit pas la sécurité. Les durées et seuils par profil sont des hypothèses. Vérifiez la météo et les consignes locales avant de partir.',
    },
  )

  return [
    el('div', { className: 'score-header' }, el('h1', { id: 'score-title' }, routeName), infoButton(notes)),
    el(
      'div',
      { className: 'stats' },
      statBox('Distance', `${summary.distanceKm.toFixed(1).replace('.', ',')} km`),
      statBox('Dénivelé positif', ascent),
      statBox('Durée estimée', formatDuration(summary.durationMin), [`dont ${formatDuration(summary.breakMin)} de pause`, ...(averageKmh === null ? [] : [`${averageKmh} km/h en marche`])]),
    ),
    el('p', { className: 'summary' }, `Départ ${timeFormat.format(start)}, arrivée vers ${timeFormat.format(summary.end)}.`),
    scoreBadge(evaluation),
    standardCriteria ? standardNotice(onSignIn) : '',
    el('ul', { className: 'criteria' }, ...[...score.criteria].sort((a, b) => displayRank(a) - displayRank(b)).map(criterionCard)),
  ]
}

/**
 * Bandeau de score en bas de la carte ; un clic ouvre la modale avec le détail des critères.
 * `onSignIn` : sans compte, le lien « Se connecter » de la mention « critères standards ».
 */
export function createScoreView(onSignIn: () => void): ScoreView {
  const bar = el('button', { type: 'button', className: 'score-bar' })
  bar.hidden = true
  bar.setAttribute('aria-haspopup', 'dialog')

  const dialog = el('dialog', { className: 'modal score-modal' })
  dialog.setAttribute('aria-labelledby', 'score-title')
  const body = el('div', { className: 'modal__body' })
  const close = el('button', { type: 'button', className: 'modal__close' }, 'Fermer')
  close.addEventListener('click', () => dialog.close())
  dialog.append(body, close)

  bar.addEventListener('click', () => {
    dialog.show()
    dialog.scrollTop = 0
  })
  document.body.append(bar, dialog)

  return {
    closeDetail() {
      dialog.close()
    },
    show(view) {
      const { score } = view.evaluation
      const verdict = score.verdict ?? 'unknown'
      bar.className = `score-bar score-bar--${verdict}`
      bar.replaceChildren(
        scoreRing(score.total, 52),
        el(
          'span',
          { className: 'score-bar__text' },
          el('strong', {}, score.verdict ? VERDICT_LABEL[score.verdict] : 'Score indisponible'),
          el('small', {}, `${view.routeName} · ${view.standardCriteria ? 'critères standards · ' : ''}voir le détail`),
        ),
      )
      bar.hidden = false
      body.replaceChildren(...detailContent(view, onSignIn))
      dialog.scrollTop = 0
    },
  }
}
