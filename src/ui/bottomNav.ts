import { MAP_ICON_PATH, odIcon, SLIDERS_ICON_PATH, VERIFY_ICON_PATH, WARNING_ICON_PATH } from './signalisationIcons'

export interface BottomNavActions {
  onReport(): void
  /** Changement d'onglet : la page Signaler se ferme */
  onLeaveReport(): void
  /** Mode consultation : ne laisse que la carte (ferme les modales et le panneau) */
  onConsult(): void
  /** Ouvre ou ferme la modale d'import ; renvoie vrai si elle est ouverte ensuite */
  onPlan(): boolean
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
 * Menu du bas : Signaler (onglet actif par défaut, lance le signalement), Consulter (la carte seule), Vérifier (rouvre la modale d'import) et Personnaliser (affiche le panneau).
 * Toucher l'onglet Personnaliser quand il est actif ferme le panneau et laisse toute la place à la carte.
 */
export interface BottomNav {
  /** Bascule sur la carte seule (après un signalement) */
  showMap(): void
  /** Met Consulter en avant sans rien fermer (après le calcul d'un score, la carte est visible) */
  markMap(): void
  /** La modale d'import vient de s'ouvrir sans passer par l'onglet (retour de Strava) */
  planOpened(): void
  /** La modale d'import vient de se fermer : la carte seule reste affichée : Consulter devient actif */
  planClosed(): void
}

export function createBottomNav(panel: HTMLElement, actions: BottomNavActions): BottomNav {
  const report = tab('Signaler', WARNING_ICON_PATH)
  const consult = tab('Consulter', MAP_ICON_PATH)
  const plan = tab('Vérifier', VERIFY_ICON_PATH)
  const custom = tab('Personnaliser', SLIDERS_ICON_PATH)

  // Signaler est l'onglet par défaut ; Consulter le remplace tant qu'on ne repasse pas par un autre onglet
  let base = report

  function select(current: HTMLButtonElement) {
    for (const button of [report, consult, plan, custom]) {
      if (button === current) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
  }

  function showCustom(visible: boolean) {
    panel.dataset.view = visible ? 'custom' : ''
    select(visible ? custom : base)
  }

  report.addEventListener('click', () => {
    base = report
    showCustom(false)
    actions.onReport()
  })
  function showMap() {
    base = consult
    showCustom(false)
    actions.onLeaveReport()
    actions.onConsult()
  }
  consult.addEventListener('click', showMap)
  plan.addEventListener('click', () => {
    showCustom(false)
    actions.onLeaveReport()
    // Refermée, la modale laisse la carte seule : Consulter
    base = actions.onPlan() ? plan : consult
    select(base)
  })
  custom.addEventListener('click', () => {
    actions.onLeaveReport()
    showCustom(panel.dataset.view !== 'custom')
  })

  const nav = document.createElement('nav')
  nav.className = 'bottom-nav'
  nav.setAttribute('aria-label', 'Navigation principale')
  nav.append(report, consult, plan, custom)
  document.body.append(nav)
  showCustom(false)
  return {
    showMap,
    markMap() {
      base = consult
      if (panel.dataset.view !== 'custom') select(base)
    },
    planOpened() {
      base = plan
      if (panel.dataset.view !== 'custom') select(base)
    },
    planClosed() {
      if (base !== plan) return
      base = consult
      if (panel.dataset.view !== 'custom') select(base)
    },
  }
}
