/** Décode une polyligne encodée (algorithme Google, précision 1e5) en points [lat, lng] */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  function nextDelta(): number {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20 && index < encoded.length)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    lat += nextDelta()
    lng += nextDelta()
    points.push([lat / 1e5, lng / 1e5])
  }
  return points
}
