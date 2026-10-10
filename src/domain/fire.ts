import type { Coordinates } from './coordinates'

/** Confiance de la détection, normalisée entre MODIS (0-100) et VIIRS (l/n/h) */
export type FireConfidence = 'low' | 'nominal' | 'high'

/** Détection satellite d'un foyer actif (NASA FIRMS, MODIS ou VIIRS) */
export interface FireDetection {
  position: Coordinates
  acquiredAt: Date
  confidence: FireConfidence
  /** Puissance radiative du feu, en mégawatts */
  frp: number
  satellite: string
}
