import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { McpServerConfig } from '@/components/codex/types';
import { Button } from '@/components/ui/button';
import { McpServerForm } from '@/features/mcp/McpServerForm';
import { unifiedAddMcpServer } from '@/services';

interface McpAddPanelProps {
  onAdded: () => void;
}

export function McpAddPanel({ onAdded }: McpAddPanelProps) {
  const { t } = useTranslation('mcp');
  const [serverName, setServerName] = useState('');
  const [protocol, setProtocol] = useState<'stdio' | 'http' | 'sse'>('stdio');
  const [commandConfig, setCommandConfig] = useState({ command: '', args: '', env: '' });
  const [httpConfig, setHttpConfig] = useState({ url: '' });
  const [adding, setAdding] = useState(false);

  const resetForm = () => {
    setServerName('');
    setProtocol('stdio');
    setCommandConfig({ command: '', args: '', env: '' });
    setHttpConfig({ url: '' });
  };

  const parseEnv = (raw: string): Record<string, string> | null => {
    try {
      const value = JSON.parse(raw);
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.values(value).some((item) => typeof item !== 'string')
      )
        throw new Error('Invalid map');
      return value;
    } catch {
      toast.error(t('jsonObjectError'));
      return null;
    }
  };

  const splitArgs = (raw: string) => raw.split(' ').filter((a) => a.trim());

  const handleAdd = async () => {
    if (!serverName.trim() || adding) return;
    setAdding(true);
    try {
      let config: McpServerConfig;
      if (protocol === 'stdio') {
        config = {
          type: 'stdio',
          command: commandConfig.command,
          args: splitArgs(commandConfig.args),
        };
        if (commandConfig.env.trim()) {
          const env = parseEnv(commandConfig.env);
          if (!env) return;
          config.env = env;
        }
      } else {
        config = { type: protocol, url: httpConfig.url.trim() };
      }
      await unifiedAddMcpServer({ clientName: 'codex', serverName, serverConfig: config });
      toast.success(t('serverAdded', { name: serverName }));
      resetForm();
      onAdded();
    } catch (error) {
      toast.error(t('addFailed', { error: String(error) }));
    } finally {
      setAdding(false);
    }
  };

  const isDisabled =
    !serverName.trim() ||
    (protocol === 'stdio' ? !commandConfig.command.trim() : !httpConfig.url.trim());

  return (
    <div className="space-y-4">
      <McpServerForm
        serverName={serverName}
        onServerNameChange={setServerName}
        protocol={protocol}
        onProtocolChange={setProtocol}
        commandConfig={commandConfig}
        onCommandConfigChange={setCommandConfig}
        httpConfig={httpConfig}
        onHttpConfigChange={(config) => setHttpConfig({ url: config.url })}
      />
      <Button onClick={handleAdd} disabled={isDisabled || adding} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {adding ? t('adding') : t('addServer')}
      </Button>
    </div>
  );
}
