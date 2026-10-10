import { CRITERION_LABEL, MODE_LABEL, PROFILES, type CriterionId, type CriterionMode, type ProfileId } from '../domain/profile'
import { SCORED_SIGNALISATION_TYPES, SIGNALISATION_TYPE_LABEL } from '../domain/signalisation'
import type { User } from '../domain/user'

export type UserChanges = Partial<Pick<User, 'activities' | 'preferences' | 'signalisationPreferences'>>

const MODES = Object.keys(MODE_LABEL) as CriterionMode[]

/** Tableau à 3 colonnes (Ignorer, Prendre en compte, Red flag) : souris, doigt et flèches du clavier. */
function createBoard<K extends string>(
  ids: K[],
  labelOf: (id: K) => string,
  modeOf: (id: K) => CriterionMode,
  onMove: (id: K, mode: CriterionMode) => void,
): HTMLElement {
  const board = document.createElement('div')
  board.className = 'mode-board'

  function move(id: K, mode: CriterionMode) {
    if (modeOf(id) === mode) return
    onMove(id, mode)
    render(id)
  }

  function render(focusId?: K) {
    board.replaceChildren()
    for (const mode of MODES) {
      const column = document.createElement('section')
      column.className = `mode-column mode-column--${mode}`
      column.dataset.mode = mode
      column.setAttribute('role', 'group')
      column.setAttribute('aria-label', MODE_LABEL[mode])
      const heading = document.createElement('h3')
      heading.textContent = MODE_LABEL[mode]
      column.append(heading)
      const inColumn = ids.filter((id) => modeOf(id) === mode)
      for (const id of inColumn) column.append(card(id, mode))
      if (inColumn.length === 0) {
        const empty = document.createElement('p')
        empty.className = 'mode-column__empty'
        empty.textContent = 'Déposez un élément ici'
        column.append(empty)
      }
      board.append(column)
    }
    if (focusId) board.querySelector<HTMLElement>(`[data-id="${focusId}"]`)?.focus()
  }

  function columnAt(event: PointerEvent): HTMLElement | null {
    return (
      document
        .elementsFromPoint(event.clientX, event.clientY)
        .find((n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('mode-column') && board.contains(n)) ?? null
    )
  }

  function card(id: K, mode: CriterionMode): HTMLElement {
    const element = document.createElement('div')
    element.className = 'mode-card'
    element.dataset.id = id
    element.tabIndex = 0
    element.setAttribute('role', 'button')
    element.setAttribute('aria-roledescription', 'élément déplaçable')
    element.setAttribute('aria-label', `${labelOf(id)}, ${MODE_LABEL[mode]}. Flèches gauche et droite pour changer de colonne.`)
    element.textContent = labelOf(id)

    element.addEventListener('keydown', (event) => {
      const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
      if (step === 0) return
      event.preventDefault()
      const target = MODES[MODES.indexOf(mode) + step]
      if (target) move(id, target)
    })

    // Pointeur (souris et tactile) : l'API de glisser-déposer HTML ne marche pas au doigt
    element.addEventListener('pointerdown', (event) => {
      element.setPointerCapture(event.pointerId)
      const startX = event.clientX
      const startY = event.clientY
      element.classList.add('mode-card--dragging')
      const onMoveEvent = (e: PointerEvent) => {
        element.style.transform = `translate(${e.clientX - startX}px, ${e.clientY - startY}px)`
        for (const col of board.querySelectorAll('.mode-column')) col.classList.toggle('mode-column--over', col === columnAt(e))
      }
      const end = (e: PointerEvent) => {
        element.removeEventListener('pointermove', onMoveEvent)
        element.removeEventListener('pointerup', end)
        element.removeEventListener('pointercancel', end)
        const target = e.type === 'pointerup' ? columnAt(e)?.dataset.mode : undefined
        element.classList.remove('mode-card--dragging')
        element.style.transform = ''
        for (const col of board.querySelectorAll('.mode-column')) col.classList.remove('mode-column--over')
        if (target) move(id, target as CriterionMode)
      }
      element.addEventListener('pointermove', onMoveEvent)
      element.addEventListener('pointerup', end)
      element.addEventListener('pointercancel', end)
    })
    return element
  }

  render()
  return board
}

/** Vue « Personnaliser » : activités pratiquées et mode de chaque critère du score. `onChange` renvoie une erreur lisible ou rien. */
export function createUserProfile(initial: User, onChange: (changes: UserChanges) => void): HTMLElement {
  let user = initial
  const message = document.createElement('p')
  message.className = 'error'
  message.setAttribute('role', 'alert')

  function apply(changes: UserChanges, restore: () => void) {
    try {
      onChange(changes)
      user = { ...user, ...changes }
      message.textContent = ''
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Modification impossible.'
      restore()
    }
  }

  const activities = document.createElement('fieldset')
  activities.className = 'user-activities'
  activities.innerHTML = '<legend>Activités pratiquées</legend>'
  for (const id of Object.keys(PROFILES) as ProfileId[]) {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = user.activities.includes(id)
    input.addEventListener('change', () => {
      const next = (Object.keys(PROFILES) as ProfileId[]).filter((p) =>
        p === id ? input.checked : user.activities.includes(p),
      )
      apply({ activities: next }, () => (input.checked = !input.checked))
    })
    const label = document.createElement('label')
    label.append(input, PROFILES[id].label)
    activities.append(label)
  }

  // Tableaux à trois colonnes (un mode par colonne) : on glisse un élément d'une colonne à l'autre.
  const criteriaBoard = createBoard(
    // Les signalements se règlent type par type dans le second tableau
    (Object.keys(CRITERION_LABEL) as CriterionId[]).filter((id) => id !== 'signalisations'),
    (id) => CRITERION_LABEL[id],
    (id) => user.preferences[id],
    (id, mode) => apply({ preferences: { ...user.preferences, [id]: mode } }, () => undefined),
  )
  const typesBoard = createBoard(
    SCORED_SIGNALISATION_TYPES,
    (type) => SIGNALISATION_TYPE_LABEL[type],
    (type) => user.signalisationPreferences[type],
    (type, mode) => apply({ signalisationPreferences: { ...user.signalisationPreferences, [type]: mode } }, () => undefined),
  )

  const section = document.createElement('section')
  section.className = 'user-profile'
  const title = document.createElement('h2')
  title.textContent = `Profil de ${user.name}`
  const hint = document.createElement('p')
  hint.className = 'hint'
  hint.textContent = 'Glissez chaque critère dans la colonne qui lui correspond. Vos choix sont gardés sur cet appareil.'
  const typesTitle = document.createElement('h3')
  typesTitle.textContent = 'Types de signalements'
  const typesHint = document.createElement('p')
  typesHint.className = 'hint'
  typesHint.textContent = 'Critère « Signalements sur le parcours » : choisissez comment traiter chaque type de signalement.'
  section.append(title, hint, activities, criteriaBoard, typesTitle, typesHint, typesBoard, message)
  return section
}
