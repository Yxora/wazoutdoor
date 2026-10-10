import type { DatabaseHealth, HealthResult } from '../application/ports'

export class SupabaseHealth implements DatabaseHealth {
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
  ) {}

  async check(): Promise<HealthResult> {
    const response = await fetch(`${this.url}/auth/v1/health`, {
      headers: { apikey: this.anonKey },
    })
    return { ok: response.ok, detail: `HTTP ${response.status}` }
  }
}
