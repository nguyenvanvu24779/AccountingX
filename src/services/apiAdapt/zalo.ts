import { postJson } from './shared';

export type ZaloAccount = {
  userId: string;
  displayName: string;
  avatar: string | null;
};

export type ZaloPairing = {
  code: string;
  canApprove: boolean;
  canCommand: boolean;
  expiresAt: string;
};

export type ZaloStatus = {
  connected: boolean;
  /** A login is under way (QR shown or waiting for the phone to approve). */
  connecting: boolean;
  /** Name on the phone that scanned the QR, while it waits for approval. */
  qrScannedBy: string | null;
  account: ZaloAccount | null;
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
