const DURATION_MS = 3500

let current: HTMLElement | null = null
let timer: number | undefined

/** Message bref en bas de l'écran, au-dessus du menu. Un nouveau message remplace le précédent. */
export function showToast(message: string): void {
  current?.remove()
  window.clearTimeout(timer)

  const toast = document.createElement('div')
  toast.className = 'od-toast'
  toast.setAttribute('role', 'status')
  toast.textContent = message
  document.body.append(toast)
  current = toast

  timer = window.setTimeout(() => {
    toast.remove()
    if (current === toast) current = null
  }, DURATION_MS)
}
