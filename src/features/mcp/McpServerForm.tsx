import type React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface McpServerFormProps {
  serverName: string;
  onServerNameChange: (name: string) => void;
  protocol: 'stdio' | 'http' | 'sse';
  onProtocolChange: (protocol: 'stdio' | 'http' | 'sse') => void;
  commandConfig: { command: string; args: string; env: string };
  onCommandConfigChange: (config: { command: string; args: string; env: string }) => void;
  httpConfig: { url: string; headers?: string };
  onHttpConfigChange: (config: { url: string; headers?: string }) => void;
  isEditMode?: boolean;
}

export const McpServerForm: React.FC<McpServerFormProps> = ({
  serverName,
  onServerNameChange,
  protocol,
  onProtocolChange,
  commandConfig,
  onCommandConfigChange,
  httpConfig,
  onHttpConfigChange,
  isEditMode = false,
}) => {
  const { t } = useTranslation('mcp');
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-1">{t('form.serverName')}</div>
        <Input
          aria-label={t('form.serverNameAria')}
          value={serverName}
          onChange={(e) => onServerNameChange(e.target.value)}
          placeholder="e.g., fetch, deepwiki"
          disabled={isEditMode} // Disable name editing in edit mode if it's used as a key
        />
      </div>

      <Tabs
        value={protocol}
        onValueChange={(value) => onProtocolChange(value as 'stdio' | 'http' | 'sse')}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stdio">Stdio</TabsTrigger>
          <TabsTrigger value="http">HTTP</TabsTrigger>
          <TabsTrigger value="sse">SSE</TabsTrigger>
        </TabsList>

        <TabsContent value="stdio" className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">{t('form.command')}</div>
            <Input
              aria-label={t('form.command')}
              value={commandConfig.command}
              onChange={(e) => onCommandConfigChange({ ...commandConfig, command: e.target.value })}
              placeholder="e.g., uvx, npx"
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">{t('form.arguments')}</div>
            <Input
              aria-label={t('form.arguments')}
              value={commandConfig.args}
              onChange={(e) => onCommandConfigChange({ ...commandConfig, args: e.target.value })}
              placeholder="e.g., -y mcp-server-fetch"
            />
          </div>
          <div>
            <div className="text-sm font-medium mb-1">{t('form.envVars')}</div>
            <Textarea
              aria-label={t('form.envVarsAria')}
              value={commandConfig.env}
              onChange={(e) => onCommandConfigChange({ ...commandConfig, env: e.target.value })}
              placeholder='{"API_KEY": "value"} - Leave empty if not needed'
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="http" className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">{t('form.url')}</div>
            <Input
              aria-label={t('form.urlAria')}
              value={httpConfig.url}
              onChange={(e) => onHttpConfigChange({ ...httpConfig, url: e.target.value })}
              placeholder="https://mcp.deepwiki.com/mcp"
            />
          </div>
        </TabsContent>
        <TabsContent value="sse" className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">{t('form.url')}</div>
            <Input
              aria-label={t('form.urlAria')}
              value={httpConfig.url}
              onChange={(e) => onHttpConfigChange({ ...httpConfig, url: e.target.value })}
              placeholder="https://mcp.deepwiki.com/sse"
            />
          </div>
        </TabsContent>
      </Tabs>
      {protocol !== 'stdio' && httpConfig.headers !== undefined && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground">
            {t('form.authHeaders')}
          </summary>
          <Textarea
            aria-label={t('form.authHeadersAria')}
            value={httpConfig.headers ?? ''}
            onChange={(event) => onHttpConfigChange({ ...httpConfig, headers: event.target.value })}
            placeholder='{"Authorization": "Bearer token"}'
            className="mt-2 font-mono text-xs"
            rows={3}
          />
        </details>
      )}
    </div>
  );
};
