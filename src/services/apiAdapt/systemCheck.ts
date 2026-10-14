import { postJson } from './shared';

export type SystemCheckStatus = 'ok' | 'warn' | 'fail';

export type SystemCheckItem = {
  /** Stable id, e.g. `codex.login`. */
  id: string;
  group: 'codex' | 'zalo' | 'browser' | 'machine';
  status: SystemCheckStatus;
  detail: string | null;
  /** The app can put this right itself. */
  autoFixable: boolean;
};

export type SystemCheckResult = {
  overall: SystemCheckStatus;
  checks: SystemCheckItem[];
};

export async function systemCheck() {
  return await postJson<SystemCheckResult>('/api/system/check', {});
}

/** Reinstall the skills, Zalo tools and defaults the app keeps in Codex's home. */
export async function systemRepair() {
  return await postJson<{ repaired: boolean }>('/api/system/repair', {});
}
