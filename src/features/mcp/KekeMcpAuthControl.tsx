import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { KekeMcpServer } from '@/services/apiAdapt/kekeMcp';
import type { useKekeMcpAuth } from './useKekeMcpAuth';

export function KekeMcpAuthControl({
  name,
  auth,
  disabled,
  config,
}: {
  name: string;
  auth: ReturnType<typeof useKekeMcpAuth>;
  disabled?: boolean;
  config?: KekeMcpServer;
}) {
  const { t } = useTranslation('mcp');
  const pending = auth.pending === name;
  const signedIn = auth.statuses[name]?.signedIn;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || auth.pending !== null}
        aria-label={
          signedIn ? t('keke.reauthorizeAria', { name }) : t('keke.authorizeAria', { name })
        }
        onClick={() => auth.authorize(name, config)}
      >
        {pending && <Loader2 className="animate-spin" data-icon="inline-start" />}
        {pending ? t('authorizing') : signedIn ? t('reauthorize') : t('authorize')}
      </Button>
      {pending && auth.githubName !== name && (
        <p className="text-xs text-muted-foreground">{t('keke.completeInDesktopBrowser')}</p>
      )}
      {auth.errors[name] && auth.githubName !== name && (
        <p role="alert" className="max-w-64 break-words text-xs text-destructive">
          {auth.errors[name]}
        </p>
      )}
    </div>
  );
}
