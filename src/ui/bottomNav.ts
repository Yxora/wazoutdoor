import { odIcon, SLIDERS_ICON_PATH, VERIFY_ICON_PATH, WARNING_ICON_PATH } from './signalisationIcons'

export interface BottomNavActions {
  onReport(): void
  onPlan(): void
}

function tab(label: string, iconPath: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'bottom-nav__tab'
  const text = document.createElement('span')
  text.textContent = label
  button.append(odIcon(iconPath, 24), text)
  return button
}

/**
 * Menu du bas : Signaler (lance le signalement), Vérifier (rouvre la modale d'import) et Personnaliser (affiche le panneau).
 * Toucher l'onglet Personnaliser quand il est actif ferme le panneau et laisse toute la place à la carte.
 */
export function createBottomNav(panel: HTMLElement, actions: BottomNavActions): void {
  const report = tab('Signaler', WARNING_ICON_PATH)
  const plan = tab('Vérifier', VERIFY_ICON_PATH)
  const custom = tab('Personnaliser', SLIDERS_ICON_PATH)

  function showCustom(visible: boolean) {
    panel.dataset.view = visible ? 'custom' : ''
    if (visible) custom.setAttribute('aria-current', 'page')
    else custom.removeAttribute('aria-current')
  }

  report.addEventListener('click', actions.onReport)
  plan.addEventListener('click', () => {
    showCustom(false)
    actions.onPlan()
  })
  custom.addEventListener('click', () => showCustom(panel.dataset.view !== 'custom'))

  const nav = document.createElement('nav')
  nav.className = 'bottom-nav'
  nav.setAttribute('aria-label', 'Navigation principale')
  nav.append(report, plan, custom)
  document.body.append(nav)
  showCustom(false)
}
