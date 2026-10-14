import { CircleAlert, CircleCheck, CircleX, Copy, Loader2, Wrench } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  type SystemCheckItem,
  type SystemCheckStatus,
  systemCheck,
  systemRepair,
} from '@/services';

const GROUP_ORDER = ['codex', 'zalo', 'browser', 'machine'] as const;

// Where a problem is dealt with, when it is in another settings screen.
const GO_TO: Record<string, string> = {
  'zalo.connection': 'zalo',
  'browser.chrome': 'browser',
  'browser.extension': 'browser',
  'browser.bridge': 'browser',
  'browser.runtime': 'browser',
  'browser.desktopApp': 'browser',
};

function StatusIcon({ status }: { status: SystemCheckStatus }) {
  if (status === 'ok')
    return <CircleCheck className="size-5 shrink-0 text-green-600" aria-hidden />;
  if (status === 'warn')
    return <CircleAlert className="size-5 shrink-0 text-amber-500" aria-hidden />;
  return <CircleX className="size-5 shrink-0 text-destructive" aria-hidden />;
}

interface SystemCheckSettingsProps {
  /** Open another settings screen, e.g. to finish connecting Zalo. */
  onNavigate?: (section: string) => void;
}

export function SystemCheckSettings({ onNavigate }: SystemCheckSettingsProps) {
  const { t } = useTranslation('systemCheck');
  const [checks, setChecks] = useState<SystemCheckItem[]>([]);
  const [overall, setOverall] = useState<SystemCheckStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const run = useCallback(async () => {
    setChecking(true);
    try {
      const result = await systemCheck();
      setChecks(result.checks);
      setOverall(result.overall);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const fixable = checks.some((c) => c.autoFixable && c.status !== 'ok');

  const repair = async () => {
    setRepairing(true);
    try {
      await systemRepair();
      await run();
    } catch (err) {
      setError(String(err));
    } finally {
      setRepairing(false);
    }
  };

  const copyReport = async () => {
    const lines = checks.map(
      (c) => `${c.status.toUpperCase().padEnd(4)} ${c.id}${c.detail ? ` (${c.detail})` : ''}`
    );
    try {
      await navigator.clipboard.writeText(
        [`AccountingX system check: ${overall}`, ...lines].join('\n')
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: nothing useful to do.
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" disabled={checking} onClick={() => void run()}>
          {checking && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {checking ? t('checking') : t('recheck')}
        </Button>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{t('checkFailed', { error })}</p>}

      {overall && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            <StatusIcon status={overall} />
            {t(`overall.${overall}`)}
          </div>
          <div className="flex gap-2">
            {fixable && (
              <Button size="sm" disabled={repairing} onClick={() => void repair()}>
                {repairing ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Wrench className="size-3.5" aria-hidden />
                )}
                {t('repair')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => void copyReport()}>
              <Copy className="size-3.5" aria-hidden />
              {copied ? t('copied') : t('copyReport')}
            </Button>
          </div>
        </div>
      )}

      {GROUP_ORDER.map((group) => {
        const items = checks.filter((c) => c.group === group);
        if (items.length === 0) return null;
        return (
          <Card key={group}>
            <CardContent className="px-4 py-2">
              <div className="border-b py-2 text-xs font-medium uppercase text-muted-foreground">
                {t(`group.${group}`)}
              </div>
              <ul className="divide-y">
                {items.map((item) => (
                  <li key={item.id} className="flex gap-3 py-3">
                    <StatusIcon status={item.status} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="text-sm font-medium">{t(`check.${item.id}.title`)}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.status === 'ok'
                          ? item.detail
                            ? t('detail', { detail: item.detail })
                            : t('ok')
                          : t(`check.${item.id}.fix`, { detail: item.detail ?? '' })}
                      </div>
                      {item.status !== 'ok' && GO_TO[item.id] && onNavigate && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-1"
                          onClick={() => onNavigate(GO_TO[item.id])}
                        >
                          {t('open')}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
