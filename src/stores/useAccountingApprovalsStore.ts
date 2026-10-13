import { create } from 'zustand';
import { type ApprovalTicket, listPendingApprovals, respondApproval } from '@/services';

interface AccountingApprovalsStore {
  pending: ApprovalTicket[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  respond: (shortCode: string, approve: boolean, approverId?: string) => Promise<void>;
}

/**
 * Tickets with a side effect (a Zalo command, a drafted email) waiting for a
 * human to say yes. The database is the source of truth — this store just
 * mirrors it for the UI, refreshed on demand rather than pushed to live, so
 * there's nothing to reconcile if a Zalo reply resolves a ticket elsewhere.
 */
export const useAccountingApprovalsStore = create<AccountingApprovalsStore>((set) => ({
  pending: [],
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const pending = await listPendingApprovals();
      set({ pending, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  respond: async (shortCode, approve, approverId) => {
    await respondApproval({ shortCode, approve, approverId });
    set((state) => ({
      pending: state.pending.filter((ticket) => ticket.shortCode !== shortCode),
    }));
  },
}));
