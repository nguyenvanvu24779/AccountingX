import { postJson } from './shared';

export type ZaloStatus = {
  connected: boolean;
  qrPath: string | null;
  lastError: string | null;
};

export type ZaloApprover = {
  zaloUserId: string;
  displayName: string;
  botId: string | null;
  canApprove: boolean;
  canCommand: boolean;
  createdAt: string;
};

export async function zaloConnect() {
  return await postJson<ZaloStatus>('/api/zalo/connect', {});
}

export async function zaloDisconnect() {
  return await postJson<ZaloStatus>('/api/zalo/disconnect', {});
}

export async function zaloStatus() {
  return await postJson<ZaloStatus>('/api/zalo/status', {});
}

export async function zaloListApprovers() {
  return await postJson<ZaloApprover[]>('/api/zalo/approvers/list', {});
}

export async function zaloAddApprover(params: {
  zaloUserId: string;
  displayName: string;
  botId?: string;
  canApprove?: boolean;
  canCommand?: boolean;
}) {
  return await postJson<ZaloApprover>('/api/zalo/approvers/add', params);
}

export async function zaloRemoveApprover(zaloUserId: string) {
  await postJson<null>('/api/zalo/approvers/remove', { zaloUserId });
}
