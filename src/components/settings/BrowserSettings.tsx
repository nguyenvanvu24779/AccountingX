import { openUrl } from '@tauri-apps/plugin-opener';
import { CircleCheck, CircleX } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type BrowserHealth, browserHealth } from '@/services';

const CHROME_DOWNLOAD_URL = 'https://www.google.com/chrome/';
const EXTENSION_STORE_URL =
  'https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg';

function CheckRow({
  ok,
  label,
  detail,
  action,
}: {
  ok: boolean;
  label: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      {ok ? (
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
      ) : (
        <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      {!ok && action}
    </div>
  );
}

export function BrowserSettings() {
  const { t } = useTranslation('browser');
  const [health, setHealth] = useState<BrowserHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setHealth(await browserHealth());
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <Button variant="outline" size="sm" disabled={checking} onClick={() => recheck()}>
          {checking ? t('checking') : t('recheck')}
        </Button>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{t('checkFailed', { error })}</p>}

      {health && (
        <Card>
          <CardContent className="divide-y px-4 py-2">
            <CheckRow
              ok={health.chromeInstalled}
              label={t('chrome')}
              detail={health.chromeInstalled ? t('ok') : t('chromeMissing')}
              action={
                <Button size="sm" variant="outline" onClick={() => openUrl(CHROME_DOWNLOAD_URL)}>
                  {t('installChrome')}
                </Button>
              }
            />
            <CheckRow
              ok={health.profilesWithExtension.length > 0}
              label={t('extension')}
              detail={
                health.profilesWithExtension.length > 0
                  ? t('extensionIn', { profiles: health.profilesWithExtension.join(', ') })
                  : t('extensionMissing')
              }
              action={
                <Button size="sm" onClick={() => openUrl(EXTENSION_STORE_URL)}>
                  {t('installExtension')}
                </Button>
              }
            />
            <CheckRow
              ok={health.nativeHost === 'ok'}
              label={t('nativeHost')}
              detail={
                health.nativeHost === 'ok' ? t('ok') : t(`nativeHostProblem.${health.nativeHost}`)
              }
            />
            <CheckRow
              ok={health.browserRuntime}
              label={t('runtime')}
              detail={health.browserRuntime ? t('ok') : t('runtimeMissing')}
            />
          </CardContent>
        </Card>
      )}

      {health?.ready && <p className="px-1 text-xs text-muted-foreground">{t('readyHint')}</p>}
    </section>
  );
}
