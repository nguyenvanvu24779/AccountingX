import { postJson } from './shared';

export type ApprovalKind = 'zaloCommand' | 'emailSend' | 'misaAction';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type EvidenceRef = {
  label: string;
  path: string;
};

export type ApprovalTicket = {
  id: string;
  shortCode: string;
  kind: ApprovalKind;
  companyId: string | null;
  summary: string;
  /** The exact action being approved — show this, not just the summary. */
  payload: Record<string, unknown> | null;
  evidence: EvidenceRef[];
  status: ApprovalStatus;
  requestedBy: string | null;
  approverId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  consumedAt: string | null;
};

export async function createApproval(params: {
  kind: ApprovalKind;
  companyId?: string;
  summary: string;
  payload?: Record<string, unknown>;
  evidence?: EvidenceRef[];
  requestedBy?: string;
}) {
  return await postJson<ApprovalTicket>('/api/approvals/create', params);
}

export async function listPendingApprovals() {
  return await postJson<ApprovalTicket[]>('/api/approvals/pending', {});
}
