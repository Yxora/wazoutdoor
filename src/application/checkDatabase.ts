import type { DatabaseHealth, HealthResult } from './ports'

export async function checkDatabase(health: DatabaseHealth): Promise<HealthResult> {
  try {
    return await health.check()
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}
