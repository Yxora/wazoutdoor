import type { RouteParser } from '../application/ports'
import type { Route, RoutePoint } from '../domain/route'

const POINT = /<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g

function attribute(attributes: string, name: string): number {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`))
  return match ? Number(match[1]) : NaN
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim()
}

/** Lecture simple d'un fichier GPX (points de trace et de route), sans dépendre du DOM. */
export class GpxRouteParser implements RouteParser {
  parse(text: string): Route {
    const points: RoutePoint[] = []

    for (const match of text.matchAll(POINT)) {
      const lat = attribute(match[2], 'lat')
      const lng = attribute(match[2], 'lon')
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue

      const eleText = match[3]?.match(/<ele>\s*([-+\d.eE]+)\s*<\/ele>/)?.[1]
      const ele = eleText === undefined ? undefined : Number(eleText)
      points.push(Number.isFinite(ele) ? { lat, lng, ele } : { lat, lng })
    }

    if (points.length < 2) {
      throw new Error('Le fichier ne contient pas de tracé exploitable (il faut au moins 2 points GPX).')
    }

    const name = text.match(/<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1] ?? text.match(/<name>([\s\S]*?)<\/name>/)?.[1]
    return { name: name ? decodeEntities(name) : 'Itinéraire importé', points }
  }
}
