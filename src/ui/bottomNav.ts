import { odIcon, ROUTE_ICON_PATH, SLIDERS_ICON_PATH, WARNING_ICON_PATH } from './signalisationIcons'

type View = 'plan' | 'custom'

export interface BottomNavActions {
  onReport(): void
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
 * Menu du bas : Signaler (lance le signalement), Planifier et Personnaliser (affichent le panneau sur la vue choisie).
 * Toucher l'onglet actif ferme le panneau et laisse toute la place à la carte.
 */
export function createBottomNav(panel: HTMLElement, actions: BottomNavActions): void {
  const report = tab('Signaler', WARNING_ICON_PATH)
  const plan = tab('Planifier', ROUTE_ICON_PATH)
  const custom = tab('Personnaliser', SLIDERS_ICON_PATH)
  const views: [View, HTMLButtonElement][] = [['plan', plan], ['custom', custom]]

  function show(view: View | '') {
    panel.dataset.view = view
    for (const [id, button] of views) {
      if (id === view) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
  }

  report.addEventListener('click', actions.onReport)
  for (const [id, button] of views) {
    button.addEventListener('click', () => show(panel.dataset.view === id ? '' : id))
  }

  const nav = document.createElement('nav')
  nav.className = 'bottom-nav'
  nav.setAttribute('aria-label', 'Navigation principale')
  nav.append(report, plan, custom)
  document.body.append(nav)
  show('plan')
}
