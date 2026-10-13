import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface KekeMcpJsonEditorProps {
  busy: boolean;
  onAdd: (name: string, config: Record<string, unknown>) => Promise<boolean>;
}

export function KekeMcpJsonEditor({ busy, onAdd }: KekeMcpJsonEditorProps) {
  const { t } = useTranslation('mcp');
  const id = useId();
  const [name, setName] = useState('');
  const [json, setJson] = useState('{\n  "command": "",\n  "args": [],\n  "env": {}\n}');
  const [error, setError] = useState('');

  const add = async () => {
    setError('');
    try {
      const config: unknown = JSON.parse(json);
      if (!name.trim()) throw new Error(t('keke.enterServerName'));
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error(t('keke.enterOneObject'));
      }
      if (await onAdd(name.trim(), config as Record<string, unknown>)) setName('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">{t('keke.customServerJson')}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">{t('keke.pasteOneDefinition')}</p>
        <Label htmlFor={`${id}-name`}>{t('keke.serverName')}</Label>
        <Input
          id={`${id}-name`}
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          placeholder="my-server"
        />
        <Label htmlFor={`${id}-json`}>{t('keke.serverConfigJson')}</Label>
        <Textarea
          id={`${id}-json`}
          value={json}
          disabled={busy}
          onChange={(event) => setJson(event.target.value)}
          rows={7}
          className="font-mono text-xs"
          spellCheck={false}
        />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="button" size="sm" disabled={busy} onClick={add}>
          {t('keke.addToKeke')}
        </Button>
      </div>
    </details>
  );
}
