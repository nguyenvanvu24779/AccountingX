import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type Bot,
  listBots,
  readFile,
  type ZaloApprover,
  type ZaloStatus,
  zaloAddApprover,
  zaloConnect,
  zaloDisconnect,
  zaloListApprovers,
  zaloRemoveApprover,
  zaloStatus,
} from '@/services';

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

function ConnectionCard() {
  const { t } = useTranslation('zalo');
  const [status, setStatus] = useState<ZaloStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await zaloStatus());
    } catch {
      // The sidecar hasn't been started yet in this session — not an error to show.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    try {
      setStatus(status?.connected ? await zaloDisconnect() : await zaloConnect());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-sm font-medium">
              {status?.connected ? t('connected') : t('notConnected')}
            </div>
            <div className="text-xs text-muted-foreground">{t('connectionDescription')}</div>
          </div>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void toggle()}>
            {status?.connected ? t('disconnect') : t('connect')}
          </Button>
        </div>

        {status?.qrPath && !status.connected && (
          <div className="flex flex-col items-center gap-2 rounded border p-4">
            <QrCode path={status.qrPath} />
            <p className="text-center text-xs text-muted-foreground">{t('scanQrHint')}</p>
          </div>
        )}

        {status?.lastError && <p className="text-xs text-destructive">{status.lastError}</p>}
      </CardContent>
    </Card>
  );
}

function ApproversCard() {
  const { t } = useTranslation('zalo');
  const [approvers, setApprovers] = useState<ZaloApprover[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [zaloUserId, setZaloUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [botId, setBotId] = useState<string>('');
  const [canApprove, setCanApprove] = useState(true);
  const [canCommand, setCanCommand] = useState(false);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    setApprovers(await zaloListApprovers());
  }, []);

  useEffect(() => {
    void refresh();
    void listBots().then(setBots);
  }, [refresh]);

  const handleAdd = async () => {
    if (!zaloUserId.trim() || !displayName.trim()) return;
    setAdding(true);
    try {
      await zaloAddApprover({
        zaloUserId: zaloUserId.trim(),
        displayName: displayName.trim(),
        botId: botId || undefined,
        canApprove,
        canCommand,
      });
      setZaloUserId('');
      setDisplayName('');
      setBotId('');
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

          <div className="space-y-1">
            <Label>{t('botLabel')}</Label>
            <Select value={botId} onValueChange={setBotId}>
              <SelectTrigger>
                <SelectValue placeholder={t('botPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {bots.map((bot) => (
                  <SelectItem key={bot.id} value={bot.id}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={canApprove} onCheckedChange={(v) => setCanApprove(v === true)} />
              {t('canApproveBadge')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={canCommand} onCheckedChange={(v) => setCanCommand(v === true)} />
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
      </CardContent>
    </Card>
  );
}

export function ZaloSettings() {
  const { t } = useTranslation('zalo');
  return (
    <section className="space-y-3">
      <h3 className="px-1 text-sm font-medium">{t('title')}</h3>
      <ConnectionCard />
      <ApproversCard />
    </section>
  );
}
