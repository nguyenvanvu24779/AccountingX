import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { unifiedAddMcpServer } from '@/services';
import { appPresets } from './appPresets';
import { ConnectorIcon } from './ConnectorIcon';

interface DefaultMcpServersProps {
  cwd?: string;
  servers: Record<string, unknown>;
  onServerAdded: () => void;
}

export function DefaultMcpServers({ cwd, servers, onServerAdded }: DefaultMcpServersProps) {
  const { t } = useTranslation('mcp');
  const [category, setCategory] = useState('featured');
  const [adding, setAdding] = useState<string | null>(null);
  const catalogKey = `codex:${cwd ?? ''}`;
  const [additions, setAdditions] = useState<{
    key: string;
    servers: Record<string, Record<string, unknown>>;
  }>({ key: '', servers: {} });
  const justAdded = additions.key === catalogKey ? additions.servers : {};
  const add = async (preset: (typeof appPresets)[number]) => {
    setAdding(preset.name);
    try {
      await unifiedAddMcpServer({
        clientName: 'codex',
        path: cwd,
        serverName: preset.name,
        serverConfig: preset.config,
      });
      toast.success(
        t('keke.addedToastSimple', {
          label: preset.label,
          access: preset.access ? ` ${preset.access}.` : '',
        })
      );
      onServerAdded();
      setAdditions((previous) => ({
        key: catalogKey,
        servers: {
          ...(previous.key === catalogKey ? previous.servers : {}),
          [preset.name]: preset.config,
        },
      }));
    } catch (error) {
      toast.error(t('keke.addFailedToastSimple', { label: preset.label, error: String(error) }));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">{t('keke.connectorsTitle')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('keke.addToolsFor', { target: t('targetCodex') })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('keke.categoryAria')}>
        {[
          { value: 'featured', label: t('keke.categoryFeatured') },
          { value: 'all', label: t('keke.categoryAll') },
          { value: 'finance', label: t('keke.categoryFinance') },
        ].map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={category === item.value ? 'secondary' : 'ghost'}
            aria-pressed={category === item.value}
            onClick={() => setCategory(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {appPresets
          .filter(
            (preset) =>
              category === 'all' ||
              (category === 'featured'
                ? preset.category !== 'finance'
                : preset.category === category)
          )
          .map((preset) => {
            const added = preset.name in servers || preset.name in justAdded;
            return (
              <div key={preset.name} className="flex items-start gap-3 rounded-lg border p-4">
                <ConnectorIcon name={preset.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">{preset.label}</span>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  {preset.access ? (
                    <span className="text-xs text-muted-foreground">{preset.access}</span>
                  ) : null}
                </div>
                {added ? (
                  <Check
                    aria-label={t('keke.configuredAria', { label: preset.label })}
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={t('keke.addAria', { label: preset.label })}
                    disabled={adding !== null}
                    onClick={() => add(preset)}
                  >
                    <Plus data-icon="inline-start" />
                    {adding === preset.name ? t('adding') : t('keke.add')}
                  </Button>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
