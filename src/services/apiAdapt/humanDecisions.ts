import type { ApprovalTicket } from './approvals';
import type { PermissionMode } from './permissions';
import { invokeTauri, isDesktopTauri } from './shared';
import type { ZaloApprover, ZaloPairing } from './zalo';

/*
 * Decisions only a person may make. They go through Tauri commands, never the
 * local HTTP API: anything on this machine can call that API — including an
 * agent's shell — and an agent must never approve its own request or add
 * itself to the Zalo approver whitelist.
 */

function requireDesktop() {
  if (!isDesktopTauri()) {
    throw new Error('Chỉ thực hiện được trong ứng dụng AccountingX trên máy tính.');
  }
}

export async function respondApproval(params: { shortCode: string; approve: boolean }) {
  requireDesktop();
  return await invokeTauri<ApprovalTicket>('approval_respond', params);
}

export async function zaloAddApprover(params: {
  zaloUserId: string;
  displayName: string;
  botId?: string;
  canApprove?: boolean;
  canCommand?: boolean;
}) {
  requireDesktop();
  return await invokeTauri<ZaloApprover>('zalo_add_approver', params);
}

export async function zaloRemoveApprover(zaloUserId: string) {
  requireDesktop();
  await invokeTauri<null>('zalo_remove_approver', { zaloUserId });
}

export async function zaloCreatePairing(params: { canApprove?: boolean; canCommand?: boolean }) {
  requireDesktop();
  return await invokeTauri<ZaloPairing>('zalo_create_pairing', params);
}

export async function zaloCancelPairing(code: string) {
  requireDesktop();
  await invokeTauri<null>('zalo_cancel_pairing', { code });
}

/** Changing how much the AI may do unasked is a human decision, so it is not on the HTTP API. */
export async function setPermissionMode(mode: PermissionMode) {
  requireDesktop();
  await invokeTauri<null>('permission_mode_set', { mode });
}
