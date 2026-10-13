import { useTranslation } from 'react-i18next';
import { AcpSessionList } from '@/components/acp/AcpSessionList';
import { SessionList } from '@/components/cc/session';
import { ThreadList } from '@/components/codex/thread/ThreadList';
import { useCCSessionManager } from '@/hooks/useCCSessionManager';
import { SideBarProjectList } from './SideBarProjectList';

type SideBarClaudeTabProps = {
  onStartNewSession: (directory: string) => void;
};

export function SideBarClaudeTab({ onStartNewSession }: SideBarClaudeTabProps) {
  const { t } = useTranslation('sidebar');
  const { handleSessionSelect } = useCCSessionManager();

  return (
    <SideBarProjectList
      onNewAction={onStartNewSession}
      newActionTitle={(name) => t('startNewSessionIn', { name })}
      renderList={(directory) => (
        <SessionList directory={directory} onSelectSession={handleSessionSelect} />
      )}
    />
  );
}

type SideBarCodexTabProps = {
  onCreateNewThread: (project: string) => void;
};

export function SideBarCodexTab({ onCreateNewThread }: SideBarCodexTabProps) {
  const { t } = useTranslation('sidebar');
  return (
    <SideBarProjectList
      onNewAction={onCreateNewThread}
      newActionTitle={(name) => t('startNewThreadIn', { name })}
      renderList={(project) => <ThreadList cwd={project} />}
    />
  );
}

type SideBarAcpTabProps = {
  onStartNewSession: (directory: string) => void;
};

export function SideBarAcpTab({ onStartNewSession }: SideBarAcpTabProps) {
  const { t } = useTranslation('sidebar');
  return (
    <SideBarProjectList
      onNewAction={onStartNewSession}
      newActionTitle={(name) => t('startNewAcpSessionIn', { name })}
      renderList={(project) => <AcpSessionList directory={project} />}
    />
  );
}
