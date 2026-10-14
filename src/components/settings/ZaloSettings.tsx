import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  readFile,
  type ZaloAccount,
  type ZaloApprover,
  type ZaloStatus,
  zaloAddApprover,
  zaloConnect,
  zaloDisconnect,
  zaloListApprovers,
  zaloRemoveApprover,
  zaloStatus,
} from '@/services';
import { ZaloPairDialog } from './ZaloPairDialog';

function QrCode({ path }: { path: string }) {
  const [dataUri, setDataUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readFile(path)
      .then((base64) => {
        if (!cancelled) setDataUri(`data:image/png;base64,${base64}`);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!dataUri) return null;
  return <img src={dataUri} alt="" className="size-48 rounded border" />;
}

// Zalo's blue tile with the account's own avatar once we know it.
function AccountAvatar({ account }: { account: ZaloAccount | null }) {
  const [failed, setFailed] = useState(false);

  if (account?.avatar && !failed) {
    return (
      <img
        src={account.avatar}
        alt=""
        className="size-10 shrink-0 rounded-full border object-cover"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0068ff] text-sm font-bold text-white"
    >
      {account?.displayName ? account.displayName.charAt(0).toUpperCase() : 'Z'}
    </div>
  );
}

function ConnectionCard({
  status,
  onStatus,
}: {
  status: ZaloStatus | null;
  onStatus: (status: ZaloStatus) => void;
}) {
  const { t } = useTranslation('zalo');
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      onStatus(
        status?.connected || status?.connecting ? await zaloDisconnect() : await zaloConnect()
      );
    } finally {
      setBusy(false);
    }
  };

  const account = status?.account;

  return (
    <Card>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AccountAvatar account={account ?? null} />
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">
                  {status?.connected ? (account?.displayName ?? t('title')) : t('title')}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-normal',
                    status?.connected
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {status?.connected ? t('connected') : t('notConnected')}
                </span>
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {account ? t('accountId', { id: account.userId }) : t('connectionDescription')}
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle()}>
            {status?.connected ? t('disconnect') : status?.connecting ? t('cancel') : t('connect')}
          </Button>
        </div>

        {status?.connecting && (
          <div className="flex flex-col items-center gap-2 rounded border p-4">
            {status.qrScannedBy ? (
              <p className="text-center text-sm">{t('qrScanned', { name: status.qrScannedBy })}</p>
            ) : status.qrPath ? (
              <>
                <QrCode path={status.qrPath} />
                <p className="text-center text-xs text-muted-foreground">{t('scanQrHint')}</p>
              </>
            ) : (
              <p className="text-center text-xs text-muted-foreground">{t('preparingQr')}</p>
            )}
          </div>
        )}

        {!status?.connecting && status?.lastError && (
          <p className="text-xs text-destructive">
            {t(`loginError.${status.lastError}`, { defaultValue: status.lastError })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ApproversCard({ status }: { status: ZaloStatus | null }) {
  const { t } = useTranslation('zalo');
  const [pairOpen, setPairOpen] = useState(false);
  const [approvers, setApprovers] = useState<ZaloApprover[]>([]);
  const [zaloUserId, setZaloUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [canApprove, setCanApprove] = useState(true);
  const [canCommand, setCanCommand] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setApprovers(await zaloListApprovers());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async () => {
    if (!zaloUserId.trim() || !displayName.trim()) return;
    setAdding(true);
    try {
      await zaloAddApprover({
        zaloUserId: zaloUserId.trim(),
        displayName: displayName.trim(),
        canApprove,
        canCommand,
      });
      setZaloUserId('');
      setDisplayName('');
      await refresh();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 px-4 py-4">
        <div>
          <h3 className="text-sm font-medium">{t('approversTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('approversDescription')}</p>
        </div>

        <div className="space-y-2">
          {approvers.map((approver) => (
            <div
              key={approver.zaloUserId}
              className="flex items-center justify-between gap-2 rounded border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{approver.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {approver.zaloUserId}
                  {approver.canApprove ? ` · ${t('canApproveBadge')}` : ''}
                  {approver.canCommand ? ` · ${t('canCommandBadge')}` : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void zaloRemoveApprover(approver.zaloUserId).then(refresh)}
              >
                {t('remove')}
              </Button>
            </div>
          ))}
          {approvers.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('noApprovers')}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" disabled={!status?.connected} onClick={() => setPairOpen(true)}>
            {t('pair.add')}
          </Button>
          {!status?.connected && (
            <span className="text-xs text-muted-foreground">{t('pair.needsConnection')}</span>
          )}
        </div>

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs">
              {t('pair.advanced')}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="zalo-user-id">{t('zaloUserIdLabel')}</Label>
                  <Input
                    id="zalo-user-id"
                    value={zaloUserId}
                    onChange={(e) => setZaloUserId(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="zalo-display-name">{t('displayNameLabel')}</Label>
                  <Input
                    id="zalo-display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={canApprove}
                    onCheckedChange={(v) => setCanApprove(v === true)}
                  />
                  {t('canApproveBadge')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={canCommand}
                    onCheckedChange={(v) => setCanCommand(v === true)}
                  />
                  {t('canCommandBadge')}
                </label>
              </div>

              <Button
                size="sm"
                disabled={!zaloUserId.trim() || !displayName.trim() || adding}
                onClick={() => void handleAdd()}
              >
                {adding ? t('adding') : t('addApprover')}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <ZaloPairDialog
          open={pairOpen}
          onOpenChange={setPairOpen}
          botName={status?.account?.displayName ?? null}
          knownIds={approvers.map((a) => a.zaloUserId)}
          onPaired={() => void refresh()}
        />
      </CardContent>
    </Card>
  );
}

export function ZaloSettings() {
  const { t } = useTranslation('zalo');
  const [status, setStatus] = useState<ZaloStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await zaloStatus();
        if (!cancelled) setStatus(next);
      } catch {
        // The sidecar hasn't been started yet in this session — not an error to show.
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="space-y-3">
      <h3 className="px-1 text-sm font-medium">{t('title')}</h3>
      <ConnectionCard status={status} onStatus={setStatus} />
      <ApproversCard status={status} />
    </section>
  );
}
