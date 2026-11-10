import { api } from './client';
import { endpoints } from './endpoints';

export type HealthData = { status: string; api: string };

/** `GET /api/v1/health` — kimlik doğrulaması gerektirmeyen erişilebilirlik kontrolü. */
export function checkHealth(timeoutMs = 5000): Promise<HealthData> {
  return api.get<HealthData>(endpoints.health, { timeoutMs });
}
