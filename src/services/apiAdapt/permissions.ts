import { postJson } from './shared';

/** `ask`: a person answers every request. `auto`: ordinary requests are answered automatically. */
export type PermissionMode = 'ask' | 'auto';

export async function getPermissionMode() {
  return await postJson<{ mode: PermissionMode }>('/api/permissions/mode', {});
}
