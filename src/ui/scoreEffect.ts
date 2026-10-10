const GOOD_FROM = 80
const BAD_UNTIL = 20
const DURATION_MS = 4500
const SCENE_MS = 7000

const CONFETTI_COLORS = ['--od-picto-blaze', '--od-picto-sun', '--od-picto-leaf', '--od-picto-water', '--od-status-ok']

function layer(kind: 'confetti' | 'rain', count: number, decorate: (piece: HTMLElement, index: number) => void): HTMLElement {
  const root = document.createElement('div')
  root.className = `score-effect score-effect--${kind}`
  root.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span')
    piece.style.left = `${Math.random() * 100}%`
    piece.style.animationDelay = `${(Math.random() * 1.5).toFixed(2)}s`
    decorate(piece, i)
    root.append(piece)
  }
  return root
}

// Contenu SVG statique : une personne ouvre la porte, regarde dehors (pluie), la referme et retourne sur son canapé
const FILL_DOOR = 'style="fill:var(--od-picto-earth)"'
const SCENE_SVG = `
<svg viewBox="0 0 320 180" role="img" aria-label="Red flag : mieux vaut rester à la maison" stroke="var(--od-ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <defs><clipPath id="scene-doorway"><rect x="30" y="40" width="70" height="120"/></clipPath></defs>
  <path d="M8 160h304" fill="none"/>
  <rect x="30" y="40" width="70" height="120" style="fill:#2b3a4a"/>
  <g clip-path="url(#scene-doorway)" stroke="var(--od-picto-water)" stroke-width="2">
    <g class="scene__rain"><path d="M42 20v14M58 0v14M74 10v14M90 -4v14M50 40v14M66 30v14M82 36v14" fill="none"/></g>
  </g>
  <g class="scene__door"><rect x="30" y="40" width="70" height="120" ${FILL_DOOR}/><circle cx="90" cy="102" r="3" style="fill:var(--od-picto-sun)"/></g>
  <rect x="215" y="105" width="80" height="35" rx="8" style="fill:var(--od-brand-pressed)"/>
  <g class="scene__hero">
    <g class="scene__bob">
      <circle cx="0" cy="98" r="10" style="fill:var(--od-picto-sun)"/>
      <rect x="-9" y="109" width="18" height="32" rx="6" style="fill:var(--od-picto-blaze)"/>
      <path d="M-4 141v19M4 141v19" fill="none"/>
    </g>
  </g>
  <rect x="210" y="135" width="90" height="25" rx="6" style="fill:var(--od-brand)"/>
  <rect x="204" y="118" width="16" height="42" rx="6" style="fill:var(--od-brand)"/>
  <rect x="290" y="118" width="16" height="42" rx="6" style="fill:var(--od-brand)"/>
  <g class="scene__bubble"><rect x="150" y="12" width="150" height="30" rx="10" style="fill:#fff"/><text x="225" y="32" text-anchor="middle" stroke="none" style="fill:var(--od-ink);font:700 14px var(--od-font-text)">Pas aujourd’hui…</text></g>
</svg>`

function playScene(): void {
  const scene = document.createElement('div')
  scene.className = 'score-scene'
  // Contenu défini dans ce fichier, jamais issu d'une source externe
  scene.innerHTML = SCENE_SVG
  document.body.append(scene)
  window.setTimeout(() => scene.remove(), SCENE_MS)
}

/**
 * Animation plein écran à l'affichage d'un nouveau score : confettis de 80 à 100, pluie de 0 à 20,
 * et la scène du canapé quand un red flag met le score à 0.
 * Purement décorative : aucun clic bloqué, désactivée si l'utilisateur·rice réduit les animations.
 */
export function playScoreEffect(total: number | null, redFlag = false): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // Un red flag a sa propre scène, à la place de la pluie
  if (redFlag) return playScene()
  if (total === null || (total > BAD_UNTIL && total < GOOD_FROM)) return

  const effect =
    total >= GOOD_FROM
      ? layer('confetti', 70, (piece, i) => {
          piece.style.background = `var(${CONFETTI_COLORS[i % CONFETTI_COLORS.length]})`
          piece.style.animationDuration = `${(2.5 + Math.random() * 1.5).toFixed(2)}s`
          piece.style.setProperty('--drift', `${Math.round(Math.random() * 160 - 80)}px`)
          piece.style.setProperty('--spin', `${Math.round(360 + Math.random() * 720)}deg`)
        })
      : layer('rain', 90, (piece) => {
          piece.style.animationDuration = `${(0.6 + Math.random() * 0.5).toFixed(2)}s`
          piece.style.height = `${Math.round(14 + Math.random() * 18)}px`
        })

  document.body.append(effect)
  window.setTimeout(() => effect.remove(), DURATION_MS)
}
