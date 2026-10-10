import type { Evaluation } from '../application/evaluateRoute'
import { listLibraryRoutes } from '../application/listLibraryRoutes'
import type { RouteLibrary } from '../application/ports'
import { PROFILES, type Profile, type ProfileId } from '../domain/profile'
import { formatDuration, type CriterionResult, type CriterionStatus, type Facet, type Verdict } from '../domain/serenity'
import { CLOSED_STATUS_ICON_PATH, odIcon, OK_STATUS_ICON_PATH, UNKNOWN_STATUS_ICON_PATH, WARNING_ICON_PATH } from './signalisationIcons'

export interface EvaluationRequest {
  profileId: ProfileId
  start: Date
  gpxText: string
}

export interface ResultView {
  routeName: string
  profile: Profile
  start: Date
  evaluation: Evaluation
}

export interface GpxExample {
  label: string
  gpx: string
}

export interface Panel {
  showLoading(): void
  showResult(view: ResultView): void
  showError(message: string): void
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

type Child = Node | string

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props)
  node.append(...children)
  return node
}

function defaultStart(): Date {
  const start = new Date()
  start.setSeconds(0, 0)
  return start
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function criterionCard(criterion: CriterionResult): HTMLElement {
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

function libraryPicker(library: RouteLibrary, onLoaded: (gpx: string, label: string) => void): HTMLElement {
  const box = el('div', { className: 'library' })
  const status = el('p', { className: 'hint', role: 'status' })

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
      box.replaceChildren(status, disconnectButton())
      return
    }
    const select = el('select', {}, el('option', { value: '' }, 'Choisir un itinéraire…'))
    for (const route of result.routes) {
      const ascent = route.ascentM === null ? '' : `, +${Math.round(route.ascentM)} m`
      select.append(el('option', { value: route.id }, `${route.name} (${route.distanceKm.toFixed(1)} km${ascent})`))
    }
    select.addEventListener('change', async () => {
      const route = result.routes.find((r) => r.id === select.value)
      if (!route) return
      status.textContent = `Chargement de « ${route.name} »…`
      try {
        onLoaded(await library.gpx(route.id), `${route.name} (${library.source})`)
        status.textContent = ''
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error)
      }
    })
    status.textContent = ''
    box.replaceChildren(el('label', { className: 'field' }, `Mes itinéraires ${library.source}`, select), status, disconnectButton())
  }

  function connectButton(): HTMLElement {
    const button = el('button', { type: 'button' }, `Connecter ${library.source}`)
    button.addEventListener('click', () => library.beginConnection())
    return button
  }

  function disconnectButton(): HTMLElement {
    const button = el('button', { type: 'button' }, `Déconnecter ${library.source}`)
    button.addEventListener('click', () => {
      library.disconnect()
      render()
    })
    return button
  }

  function render() {
    if (library.isConnected()) void showRoutes()
    else box.replaceChildren(connectButton(), el('p', { className: 'hint' }, `Powered by ${library.source}`))
  }

  render()
  return box
}

export function createPanel(
  root: HTMLElement,
  example: GpxExample,
  onEvaluate: (request: EvaluationRequest) => void,
  library?: RouteLibrary,
): Panel {
  let gpxText: string | null = null

  const gpxLabel = el('p', { className: 'hint' }, 'Aucun tracé choisi.')
  const fileInput = el('input', { type: 'file', accept: '.gpx,application/gpx+xml,text/xml' })
  const startInput = el('input', { type: 'datetime-local', required: true, value: toLocalInputValue(defaultStart()) })
  const submit = el('button', { type: 'submit', className: 'primary' }, 'Calculer le score')
  const result = el('section', { className: 'result' })
  result.setAttribute('aria-live', 'polite')

  const profileInputs = (Object.keys(PROFILES) as ProfileId[]).map((id, index) =>
    el('input', { type: 'radio', name: 'profile', value: id, checked: index === 0 }),
  )
  const profileField = el(
    'fieldset',
    { className: 'profiles' },
    el('legend', {}, 'Votre profil'),
    ...profileInputs.map((input) => el('label', {}, input, PROFILES[input.value as ProfileId].label)),
  )

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    gpxText = await file.text()
    gpxLabel.textContent = `Tracé : ${file.name}`
  })

  const exampleButton = el('button', { type: 'button' }, 'Utiliser l’exemple')
  exampleButton.addEventListener('click', () => {
    gpxText = example.gpx
    fileInput.value = ''
    gpxLabel.textContent = `Tracé : ${example.label}`
  })

  const libraryField = library ? libraryPicker(library, (gpx, label) => {
    gpxText = gpx
    fileInput.value = ''
    gpxLabel.textContent = `Tracé : ${label}`
  }) : ''

  const form = el(
    'form',
    { className: 'form' },
    profileField,
    el('label', { className: 'field' }, 'Heure de départ', startInput),
    libraryField,
    el('label', { className: 'field' }, 'Tracé GPX', fileInput),
    el('div', { className: 'row' }, exampleButton, gpxLabel),
    submit,
  )
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (gpxText === null) {
      panel.showError('Choisissez un fichier GPX ou utilisez l’exemple.')
      return
    }
    const profileId = (profileInputs.find((i) => i.checked)?.value ?? 'randonneur') as ProfileId
    const start = new Date(startInput.value)
    if (Number.isNaN(start.getTime())) {
      panel.showError('Indiquez une heure de départ valide.')
      return
    }
    onEvaluate({ profileId, start, gpxText })
  })

  root.append(
    el('h1', {}, 'Wazoutdoor'),
    el('p', { className: 'tagline' }, 'Score de sérénité d’un itinéraire, massif des Vosges. Prototype.'),
    form,
    result,
  )

  const panel: Panel = {
    showLoading() {
      submit.disabled = true
      result.replaceChildren(el('p', { className: 'hint' }, 'Calcul en cours : altitude, coucher du soleil, météo, eau et abris…'))
    },
    showError(message) {
      submit.disabled = false
      result.replaceChildren(el('p', { className: 'error', role: 'alert' }, message))
    },
    showResult({ routeName, profile, start, evaluation }) {
      submit.disabled = false
      const { summary, score } = evaluation

      const ascent = summary.ascentM === null ? 'dénivelé inconnu' : `+${Math.round(summary.ascentM)} m`
      const headline =
        score.total === null || score.verdict === null
          ? el('p', { className: 'error' }, 'Aucun critère n’a pu être calculé.')
          : el(
              'div',
              { className: `score score--${score.verdict}` },
              el('span', { className: 'score__value' }, String(score.total), el('small', {}, '/100')),
              el('span', { className: 'score__verdict' }, VERDICT_LABEL[score.verdict]),
            )

      const coverage =
        score.availableCriteria < score.totalCriteria
          ? el(
              'p',
              { className: 'warning' },
              `Score calculé sur ${score.availableCriteria} critère(s) disponible(s) sur ${score.totalCriteria}. Les critères indisponibles ne sont pas comptés comme favorables.`,
            )
          : ''

      result.replaceChildren(
        el('h2', {}, routeName),
        el(
          'p',
          { className: 'summary' },
          `${summary.distanceKm.toFixed(1)} km · ${ascent} · ${formatDuration(summary.durationMin)} estimées (profil ${profile.label.toLowerCase()}) · départ ${timeFormat.format(start)}, arrivée vers ${timeFormat.format(summary.end)}`,
        ),
        headline,
        coverage,
        el('ul', { className: 'criteria' }, ...score.criteria.map(criterionCard)),
        el(
          'p',
          { className: 'disclaimer' },
          'Ce score aide à préparer une sortie, il ne garantit pas la sécurité. Les durées et seuils par profil sont des hypothèses. Vérifiez la météo et les consignes locales avant de partir.',
        ),
      )
    },
  }

  return panel
}
