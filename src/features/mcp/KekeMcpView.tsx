import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  addKekeMcpServer,
  type KekeMcpServer,
  readKekeMcpServers,
  removeKekeMcpServer,
} from '@/services/apiAdapt/kekeMcp';
import { unifiedReadMcpConfig } from '@/services/apiAdapt/mcp';
import { ConnectorIcon } from './ConnectorIcon';
import { KekeGitHubAuthDialog } from './KekeGitHubAuthDialog';
import { KekeMcpAuthControl } from './KekeMcpAuthControl';
import { KekeMcpJsonEditor } from './KekeMcpJsonEditor';
import { needsPresetAuthorization } from './mcpAuthentication';
import { useKekeMcpAuth } from './useKekeMcpAuth';

/** Manage shared Bot definitions here; access selection belongs to Bot settings. */
export function KekeMcpView({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useTranslation('mcp');
  const auth = useKekeMcpAuth();
  const [servers, setServers] = useState<Record<string, KekeMcpServer>>({});
  const [imports, setImports] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [removeName, setRemoveName] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setServers(await readKekeMcpServers());
      setError('');
    } catch (failure) {
      setError(String(failure));
    } finally {
      setLoading(false);
    }
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: External connector changes intentionally reload definitions.
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const add = async (name: string, config: Record<string, unknown>) => {
    setBusy(true);
    try {
      await addKekeMcpServer(name, config);
      await load();
      toast.success(t('keke.addedToast', { name }));
      if (needsPresetAuthorization(config)) await auth.authorize(name, config);
      return true;
    } catch (failure) {
      toast.error(t('keke.addFailedToast', { name, error: String(failure) }));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const remove = async (name: string) => {
    setBusy(true);
    try {
      await removeKekeMcpServer(name);
      setRemoveName(null);
      await load();
    } catch (failure) {
      toast.error(t('keke.removeFailedToast', { name, error: String(failure) }));
    } finally {
      setBusy(false);
    }
  };
  const readImports = async () => {
    setBusy(true);
    try {
      setImports((await unifiedReadMcpConfig('codex')).mcpServers ?? {});
    } catch (failure) {
      toast.error(t('keke.readFailedToast', { error: String(failure) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4">
      <KekeGitHubAuthDialog auth={auth} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{t('keke.botConnectors')}</h3>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t('keke.refreshAria')}
          title={t('keke.refresh')}
          onClick={() => {
            load();
            auth.refresh();
          }}
        >
          <RefreshCw />
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t('keke.loadFailed', { error })}
        </p>
      )}
      {loading && <p className="text-sm text-muted-foreground">{t('loading')}</p>}
      {auth.error && (
        <p role="alert" className="text-sm text-destructive">
          {t('keke.checkAuthFailed', { error: auth.error })}
        </p>
      )}
      {!loading && !error && Object.keys(servers).length === 0 && (
        <p className="text-sm text-muted-foreground">{t('keke.empty')}</p>
      )}
      {Object.entries(servers).map(([name, config]) => (
        <div key={name} className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-3">
            <ConnectorIcon name={name} />
            <span className="min-w-0 flex-1 break-all text-sm font-medium">{name}</span>
            <Badge variant="secondary">
              {config.disabled
                ? t('keke.disabled')
                : auth.statuses[name]?.signedIn
                  ? t('keke.authorized')
                  : t('keke.configured')}
            </Badge>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoveName(name)}>
              {t('keke.remove')}
            </Button>
          </div>
          {(config.type === 'http' || config.type === 'sse') && !config.disabled && (
            <KekeMcpAuthControl name={name} auth={auth} disabled={busy} config={config} />
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              {t('keke.configuration')}
            </summary>
            <p className="my-2 text-muted-foreground">{t('keke.configurationMaySecret')}</p>
            {auth.statuses[name]?.error && (
              <p className="my-2 text-destructive">
                {t('keke.authStatusUnavailable', { error: auth.statuses[name].error })}
              </p>
            )}
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(config, null, 2)}
            </pre>
          </details>
          {removeName === name && (
            <div className="flex flex-col gap-2">
              <p className="text-xs">{t('keke.removeConfirm', { name })}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void remove(name)}
                >
                  {t('keke.confirmRemoval')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setRemoveName(null)}
                >
                  {t('keke.cancel')}
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      <details>
        <summary className="cursor-pointer text-sm font-medium">{t('keke.advanced')}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            {t('keke.storedAt', { path: '~/.keke/.mcp.json' })}
          </p>
          <KekeMcpJsonEditor busy={busy || loading || Boolean(error)} onAdd={add} />
          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm">{t('keke.importFromCodex')}</summary>
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">{t('keke.reviewBeforeCopying')}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || loading || Boolean(error)}
                onClick={() => void readImports()}
              >
                {t('keke.readCodexDefinitions')}
              </Button>
              {imports && Object.keys(imports).length === 0 && (
                <p className="text-xs text-muted-foreground">{t('keke.noDefinitionsFound')}</p>
              )}
              {imports &&
                Object.entries(imports).map(([name, config]) => (
                  <details key={name}>
                    <summary className="cursor-pointer text-xs">
                      {t('keke.reviewConfig', { name })}
                    </summary>
                    <pre className="my-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs">
                      {JSON.stringify(config, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        busy ||
                        name in servers ||
                        !config ||
                        typeof config !== 'object' ||
                        Array.isArray(config)
                      }
                      onClick={() => void add(name, config as Record<string, unknown>)}
                    >
                      {t('keke.importItem', { name })}
                    </Button>
                  </details>
                ))}
            </div>
          </details>
        </div>
      </details>
    </div>
  );
}
