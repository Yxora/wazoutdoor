const MAX_SIDE_PX = 1024
const JPEG_QUALITY = 0.7

/** Réduit une photo de l'appareil en JPEG léger (data URL) avant envoi. */
export async function resizeToJpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Traitement de la photo impossible.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/** La base est publique en écriture : on n'affiche que des adresses https ou une photo JPEG locale */
export function isDisplayablePhoto(url: string | undefined): url is string {
  return !!url && (url.startsWith('https://') || url.startsWith('data:image/jpeg;base64,'))
}
