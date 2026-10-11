import logoNomUrl from './assets/logo-nom.png'

/** Logo et nom, en tête des pages et modales (Vérifier, Signaler, Personnaliser) */
export function createBrandLogo(): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'brand'
  const img = document.createElement('img')
  img.className = 'brand__logo'
  img.src = logoNomUrl
  img.alt = 'Trace OK'
  img.width = 420
  img.height = 364
  wrapper.append(img)
  return wrapper
}
