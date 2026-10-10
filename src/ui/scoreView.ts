import type { Evaluation } from '../application/evaluateRoute'
import { MODE_LABEL, type Profile } from '../domain/profile'
import { formatDuration, type CriterionResult, type CriterionStatus, type Facet, type Verdict } from '../domain/serenity'
import { el, type Child } from './dom'
import { CLOSED_STATUS_ICON_PATH, odIcon, OK_STATUS_ICON_PATH, UNKNOWN_STATUS_ICON_PATH, WARNING_ICON_PATH } from './signalisationIcons'

export interface ResultView {
  routeName: string
  profile: Profile
  start: Date
  evaluation: Evaluation
}

export interface ScoreView {
  /** Affiche (ou met à jour) le score en bas de la carte et le détail dans la modale */
  show(view: ResultView): void
  /** Ferme la modale de détail */
  closeDetail(): void
}

const VERDICT_LABEL: Record<Verdict, string> = {
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

  return el(
    'li',
    { className: `criterion criterion--${criterion.status}` },
    el(
      'div',
      { className: 'criterion__head' },
      el('span', { className: 'criterion__icon' }, odIcon(STATUS_ICON_PATH[criterion.status], 20)),
      el('strong', {}, criterion.label),
      el('span', { className: 'criterion__status' }, STATUS_TEXT[criterion.status]),
      criterion.mode === 'veto' ? el('span', { className: 'criterion__mode' }, MODE_LABEL.veto) : '',
      criterion.score === null ? '' : el('span', { className: 'criterion__score' }, `${criterion.score}/100`),
    ),
    el('p', { className: 'criterion__detail' }, criterion.detail),
    criterion.facets ? facetList(criterion.facets) : '',
    el('p', { className: 'criterion__source' }, `Source : ${meta.join(' · ')}`),
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
    el('span', { className: 'score__value' }, String(score.total), el('small', {}, '/100')),
    el('span', { className: 'score__verdict' }, VERDICT_LABEL[score.verdict]),
  )
}

function detailContent({ routeName, profile, start, evaluation }: ResultView): Child[] {
  const { summary, score } = evaluation
  const ascent = summary.ascentM === null ? 'dénivelé inconnu' : `+${Math.round(summary.ascentM)} m`

  const vetoed = score.criteria.find((c) => c.id === score.vetoedBy)
  const veto = vetoed
    ? el(
        'p',
        { className: 'warning' },
        vetoed.redFlag
          ? `Score mis à 0 : « ${vetoed.redFlag} » est signalé sur votre parcours et vous l’avez réglé sur « ${MODE_LABEL.veto} ».`
          : `Score mis à 0 : « ${vetoed.label} » est en alerte et vous l’avez réglé sur « ${MODE_LABEL.veto} ».`,
      )
    : ''

  const coverage =
    score.availableCriteria < score.totalCriteria
      ? el(
          'p',
          { className: 'warning' },
          `Score calculé sur ${score.availableCriteria} critère(s) disponible(s) sur ${score.totalCriteria}. Les critères indisponibles ne sont pas comptés comme favorables.`,
        )
      : ''

  return [
    el('h1', { id: 'score-title' }, routeName),
    el(
      'p',
      { className: 'summary' },
      `${summary.distanceKm.toFixed(1)} km · ${ascent} · ${formatDuration(summary.durationMin)} estimées (profil ${profile.label.toLowerCase()}) · départ ${timeFormat.format(start)}, arrivée vers ${timeFormat.format(summary.end)}`,
    ),
    scoreBadge(evaluation),
    el(
      'p',
      { className: 'disclaimer' },
      'À prendre avec du recul : ce score aide à préparer une sortie, il ne garantit pas la sécurité. Les durées et seuils par profil sont des hypothèses. Vérifiez la météo et les consignes locales avant de partir.',
    ),
    veto,
    coverage,
    el('ul', { className: 'criteria' }, ...[...score.criteria].sort((a, b) => displayRank(a) - displayRank(b)).map(criterionCard)),
  ]
}

/** Bandeau de score en bas de la carte ; un clic ouvre la modale avec le détail des critères */
export function createScoreView(): ScoreView {
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
        el('span', { className: 'score-bar__value' }, score.total === null ? '–' : String(score.total), el('small', {}, '/100')),
        el(
          'span',
          { className: 'score-bar__text' },
          el('strong', {}, score.verdict ? VERDICT_LABEL[score.verdict] : 'Score indisponible'),
          el('small', {}, `${view.routeName} · voir le détail`),
        ),
      )
      bar.hidden = false
      body.replaceChildren(...detailContent(view))
      dialog.scrollTop = 0
    },
  }
}
