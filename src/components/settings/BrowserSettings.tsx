import { openUrl } from '@tauri-apps/plugin-opener';
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type BrowserHealth, browserHealth } from '@/services';

const CHROME_DOWNLOAD_URL = 'https://www.google.com/chrome/';
const EXTENSION_STORE_URL =
  'https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg';

// While something is missing, look again often so the screen turns green by
// itself once the person has done the step; afterwards only now and then.
const POLL_WHILE_INCOMPLETE_MS = 4000;
const POLL_WHEN_READY_MS = 20000;

type StepState = 'done' | 'current' | 'later';

interface Step {
  id: string;
  title: string;
  ok: boolean;
  /** Shown while the step is not done. */
  help: string;
  /** Shown when the step is done. */
  doneDetail: string;
  action?: ReactNode;
}

function StepRow({ index, step, state }: { index: number; step: Step; state: StepState }) {
  return (
    <li className={cn('flex gap-3 py-3', state === 'later' && 'opacity-60')}>
      {state === 'done' ? (
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-green-600" aria-label="Xong" />
      ) : (
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
            state === 'current' && 'border-primary bg-primary text-primary-foreground'
          )}
        >
          {index}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm font-medium">{step.title}</div>
        <div className="text-xs text-muted-foreground">
          {state === 'done' ? step.doneDetail : step.help}
        </div>
        {state === 'current' && step.action && <div className="pt-1">{step.action}</div>}
      </div>
    </li>
  );
}

export function BrowserSettings() {
  const { t } = useTranslation('browser');
  const [health, setHealth] = useState<BrowserHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await browserHealth());
      setCheckedAt(new Date());
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  const needsAttention = !health || !health.ready || health.desktopAppRunning;
  useEffect(() => {
    const interval = setInterval(
      () => void recheck(),
      needsAttention ? POLL_WHILE_INCOMPLETE_MS : POLL_WHEN_READY_MS
    );
    // Coming back from Chrome or the Store: check right away.
    const onFocus = () => void recheck();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [needsAttention, recheck]);

  const steps: Step[] = health
    ? [
        {
          id: 'chrome',
          title: t('step.chrome.title'),
          ok: health.chromeInstalled,
          help: t('step.chrome.help'),
          doneDetail: t('step.chrome.done'),
          action: (
            <Button onClick={() => openUrl(CHROME_DOWNLOAD_URL)}>{t('step.chrome.action')}</Button>
          ),
        },
        {
          id: 'extension',
          title: t('step.extension.title'),
          ok: health.profilesWithExtension.length > 0,
          help: t('step.extension.help'),
          doneDetail: t('step.extension.done', {
            profiles: health.profilesWithExtension.join(', '),
          }),
          action: (
            <Button onClick={() => openUrl(EXTENSION_STORE_URL)}>
              {t('step.extension.action')}
            </Button>
          ),
        },
        {
          id: 'bridge',
          title: t('step.bridge.title'),
          ok: health.nativeHost === 'ok',
          help: t(`step.bridge.problem.${health.nativeHost}`, {
            defaultValue: t('step.bridge.help'),
          }),
          doneDetail: t('step.bridge.done'),
        },
        {
          id: 'runtime',
          title: t('step.runtime.title'),
          ok: health.browserRuntime,
          help: t('step.runtime.help'),
          doneDetail: t('step.runtime.done'),
        },
      ]
    : [];

  const firstOpen = steps.findIndex((s) => !s.ok);
  const stateOf = (index: number, step: Step): StepState =>
    step.ok ? 'done' : index === firstOpen ? 'current' : 'later';
  const remaining = steps.filter((s) => !s.ok).length;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <h3 className="text-sm font-medium">{t('title')}</h3>
          <p className="text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button variant="outline" size="sm" disabled={checking} onClick={() => void recheck()}>
            {checking && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {checking ? t('checking') : t('recheck')}
          </Button>
          {checkedAt && (
            <span className="text-xs text-muted-foreground">
              {t('checkedAt', { time: checkedAt.toLocaleTimeString() })}
            </span>
          )}
        </div>
      </div>

      {error && <p className="px-1 text-xs text-destructive">{t('checkFailed', { error })}</p>}

      {health?.desktopAppRunning && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
          <p>{t('desktopAppRunning')}</p>
        </div>
      )}

      {health && (
        <Card>
          <CardContent className="px-4 py-2">
            <div
              className={cn(
                'border-b py-3 text-sm font-medium',
                health.ready ? 'text-green-700 dark:text-green-400' : 'text-foreground'
              )}
            >
              {health.ready ? t('allReady') : t('stepsLeft', { count: remaining })}
            </div>
            <ol className="divide-y">
              {steps.map((step, index) => (
                <StepRow key={step.id} index={index + 1} step={step} state={stateOf(index, step)} />
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {health?.ready && (
        <Card>
          <CardContent className="space-y-2 px-4 py-4">
            <div className="text-sm font-medium">{t('howTo.title')}</div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t('howTo.step1', { profile: health.profilesWithExtension[0] })}</li>
              <li>{t('howTo.step2')}</li>
              <li>{t('howTo.step3')}</li>
              <li>{t('howTo.step4')}</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
