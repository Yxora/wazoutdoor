import type { RouteLibrary, RouteSummary } from './ports'

export type LibraryRoutesResult =
  | { ok: true; routes: RouteSummary[] }
  | { ok: false; reason: 'not-connected' | 'failed'; detail: string }

export async function listLibraryRoutes(library: RouteLibrary): Promise<LibraryRoutesResult> {
  if (!library.isConnected()) {
    return { ok: false, reason: 'not-connected', detail: `Connectez ${library.source} pour voir vos itinéraires.` }
  }
  try {
    return { ok: true, routes: await library.list() }
  } catch (error) {
    return { ok: false, reason: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }
}
