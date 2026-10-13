import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ApprovalTicket } from '@/services';
import { useAccountingApprovalsStore } from '@/stores/useAccountingApprovalsStore';

function PayloadDetails({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useTranslation('approvals');

  return (
    <dl className="space-y-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      {Object.entries(payload).map(([key, value]) => (
        <div key={key} className="space-y-0.5">
          <dt className="text-xs text-muted-foreground">
            {t(`field.${key}`, { defaultValue: key })}
          </dt>
          <dd className="whitespace-pre-wrap break-words">
            {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TicketCard({ ticket }: { ticket: ApprovalTicket }) {
  const { t } = useTranslation('approvals');
  const respond = useAccountingApprovalsStore((s) => s.respond);

  return (
    <Card>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{ticket.summary}</div>
            <div className="text-xs text-muted-foreground">
              {t(`kind.${ticket.kind}`)} · {t('code', { code: ticket.shortCode })}
              {ticket.requestedBy ? ` · ${t('requestedBy', { who: ticket.requestedBy })}` : ''}
            </div>
          </div>
        </div>

        {ticket.payload && <PayloadDetails payload={ticket.payload} />}

        {ticket.evidence.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">{t('evidence')}</div>
            <div className="flex flex-wrap gap-2">
              {ticket.evidence.map((item) => (
                <Button
                  key={item.path}
                  variant="outline"
                  size="sm"
                  onClick={() => revealItemInDir(item.path)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => respond(ticket.shortCode, false)}>
            {t('reject')}
          </Button>
          <Button size="sm" onClick={() => respond(ticket.shortCode, true)}>
            {t('approve')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ApprovalsSettings() {
  const { t } = useTranslation('approvals');
  const { pending, loading, error, refresh } = useAccountingApprovalsStore();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => refresh()}>
          {t('refresh')}
        </Button>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{t('loadFailed', { error })}</p>}

      {pending.length === 0 && !loading && !error && (
        <p className="px-1 text-xs text-muted-foreground">{t('empty')}</p>
      )}

      <div className="space-y-3">
        {pending.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </section>
  );
}
