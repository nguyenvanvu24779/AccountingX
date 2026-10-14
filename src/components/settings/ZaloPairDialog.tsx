import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type ZaloApprover,
  type ZaloPairing,
  zaloCancelPairing,
  zaloCreatePairing,
  zaloListApprovers,
} from '@/services';

const POLL_MS = 2000;

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

interface ZaloPairDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the bot's own Zalo account, so people know who to message. */
  botName: string | null;
  /** Approvers already on the list; anyone new while the dialog is open is the one who paired. */
  knownIds: string[];
  onPaired: () => void;
}

/**
 * Adds an approver without anyone looking up a Zalo ID: show a short code, the
 * person sends `GHEP <code>` to the bot, and the app reads their ID and name
 * from that message.
 */
export function ZaloPairDialog({
  open,
  onOpenChange,
  botName,
  knownIds,
  onPaired,
}: ZaloPairDialogProps) {
  const { t } = useTranslation('zalo');
  const [pairing, setPairing] = useState<ZaloPairing | null>(null);
  const [paired, setPaired] = useState<ZaloApprover | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const knownIdsRef = useRef(knownIds);
  knownIdsRef.current = knownIds;
  const pairingRef = useRef<ZaloPairing | null>(null);
  pairingRef.current = pairing;

  const expiresAt = pairing ? new Date(pairing.expiresAt).getTime() : 0;
  const expired = pairing !== null && now >= expiresAt;

  const cancelCode = useCallback(() => {
    const current = pairingRef.current;
    if (current) void zaloCancelPairing(current.code).catch(() => undefined);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      cancelCode();
      setPairing(null);
      setPaired(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const createCode = async () => {
    setError(null);
    cancelCode();
    try {
      setPairing(await zaloCreatePairing({ canApprove: true, canCommand: true }));
    } catch (err) {
      setError(String(err));
    }
  };

  // A code is ready as soon as the dialog opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only react to opening
  useEffect(() => {
    if (open && !pairing && !paired) void createCode();
  }, [open]);

  // Tick for the countdown, and watch the approver list for the person who pairs.
  useEffect(() => {
    if (!open || !pairing || paired || expired) return;
    const interval = setInterval(async () => {
      setNow(Date.now());
      try {
        const list = await zaloListApprovers();
        const added = list.find((a) => !knownIdsRef.current.includes(a.zaloUserId));
        if (added) {
          setPaired(added);
          onPaired();
        }
      } catch {
        // Keep waiting; the next tick tries again.
      }
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [open, pairing, paired, expired, onPaired]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pair.title')}</DialogTitle>
          <DialogDescription>{t('pair.description')}</DialogDescription>
        </DialogHeader>

        {paired ? (
          <p className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
            {t('pair.done', { name: paired.displayName })}
          </p>
        ) : !pairing ? (
          <p className="text-sm text-muted-foreground">{t('pair.preparing')}</p>
        ) : expired ? (
          <p className="text-sm text-muted-foreground">{t('pair.expired')}</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-4 text-center">
              <div className="font-mono text-2xl font-semibold tracking-wide">
                GHEP {pairing.code}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('pair.expiresIn', { time: formatRemaining(expiresAt - now) })}
              </div>
            </div>
            <p className="text-sm">{t('pair.instructions', { bot: botName ?? 'Zalo' })}</p>
            <p className="text-xs text-muted-foreground">{t('pair.waiting')}</p>
          </div>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          {paired ? (
            <Button onClick={() => handleOpenChange(false)}>{t('pair.close')}</Button>
          ) : expired ? (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={() => void createCode()}>{t('pair.newCode')}</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {t('cancel')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
