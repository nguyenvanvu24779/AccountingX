import type { TFunction } from 'i18next';
import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GetAccountRateLimitsResponse, RateLimitWindow } from '@/bindings/v2';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getAccountRateLimits } from '@/services';

function formatReset(resetsAt: number | null, locale: string) {
  if (resetsAt == null) return null;
  // Codex reports Unix seconds.
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(resetsAt * 1000));
}

function windowLabel(minutes: number | null, t: TFunction<'accountUsage'>) {
  if (minutes == null) return t('window.generic');
  if (minutes % (60 * 24 * 7) === 0) return t('window.weeks', { count: minutes / (60 * 24 * 7) });
  if (minutes % (60 * 24) === 0) return t('window.days', { count: minutes / (60 * 24) });
  if (minutes % 60 === 0) return t('window.hours', { count: minutes / 60 });
  return t('window.minutes', { count: minutes });
}

function WindowRow({ window, locale }: { window: RateLimitWindow; locale: string }) {
  const { t } = useTranslation('accountUsage');
  const used = Math.max(0, Math.min(100, Math.round(window.usedPercent)));
  const reset = formatReset(window.resetsAt, locale);

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{windowLabel(window.windowDurationMins, t)}</span>
        <span className="font-semibold tabular-nums">{t('used', { percent: used })}</span>
      </div>
      <Progress value={used} aria-label={windowLabel(window.windowDurationMins, t)} />
      {reset && <div className="text-xs text-muted-foreground">{t('resets', { time: reset })}</div>}
    </div>
  );
}

export function UsageSettings() {
  const { t, i18n } = useTranslation('accountUsage');
  const [data, setData] = useState<GetAccountRateLimitsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAccountRateLimits());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const limits = data?.rateLimits;
  const resetCredits = data?.rateLimitResetCredits?.availableCount ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => void refresh()}>
          <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} aria-hidden />
          {t('refresh')}
        </Button>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{t('loadFailed', { error })}</p>}

      {limits && (
        <Card>
          <CardContent className="space-y-4 px-4 py-4">
            {limits.planType && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('plan')}</span>
                <span className="font-medium capitalize">{limits.planType}</span>
              </div>
            )}
            {limits.primary && <WindowRow window={limits.primary} locale={i18n.language} />}
            {limits.secondary && <WindowRow window={limits.secondary} locale={i18n.language} />}
            {!limits.primary && !limits.secondary && (
              <p className="text-sm text-muted-foreground">{t('noData')}</p>
            )}
            {limits.rateLimitReachedType && (
              <p className="text-sm text-destructive">{t('reached')}</p>
            )}
            {limits.credits?.hasCredits && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('credits')}</span>
                <span className="font-medium tabular-nums">
                  {limits.credits.unlimited ? t('unlimited') : limits.credits.balance}
                </span>
              </div>
            )}
            {resetCredits > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('resetCredits')}</span>
                <span className="font-medium tabular-nums">{resetCredits}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
