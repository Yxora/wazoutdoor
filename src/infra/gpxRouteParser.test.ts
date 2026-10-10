import { describe, expect, it } from 'vitest'
import { GpxRouteParser } from './gpxRouteParser'

const parser = new GpxRouteParser()

const gpx = `<?xml version="1.0"?>
<gpx version="1.1" creator="test">
  <metadata><name>Fichier</name></metadata>
  <trk>
    <name>Boucle &amp; sommet</name>
    <trkseg>
      <trkpt lat="48.0496" lon="7.0203"><ele>1099.5</ele></trkpt>
      <trkpt lon='7.0189' lat='48.0408'><ele>1163</ele></trkpt>
      <trkpt lat="48.0305" lon="7.0150"/>
    </trkseg>
  </trk>
</gpx>`

describe('GpxRouteParser', () => {
  it('lit les points, les altitudes et le nom du tracé', () => {
    const route = parser.parse(gpx)
    expect(route.name).toBe('Boucle & sommet')
    expect(route.points).toEqual([
      { lat: 48.0496, lng: 7.0203, ele: 1099.5 },
      { lat: 48.0408, lng: 7.0189, ele: 1163 },
      { lat: 48.0305, lng: 7.015 },
    ])
  })

  it('accepte les points de route (rtept)', () => {
    const route = parser.parse('<gpx><rte><rtept lat="48" lon="7"/><rtept lat="48.1" lon="7.1"/></rte></gpx>')
    expect(route.points).toHaveLength(2)
    expect(route.name).toBe('Itinéraire importé')
  })

  it('refuse un fichier sans tracé', () => {
    expect(() => parser.parse('<gpx><wpt lat="48" lon="7"/></gpx>')).toThrow(/tracé exploitable/)
    expect(() => parser.parse('pas du xml')).toThrow()
  })

  it('ignore les points aux coordonnées invalides', () => {
    const route = parser.parse('<gpx><trkpt lat="148" lon="7"/><trkpt lat="48" lon="7"/><trkpt lat="48.1" lon="7"/></gpx>')
    expect(route.points).toHaveLength(2)
  })
})
