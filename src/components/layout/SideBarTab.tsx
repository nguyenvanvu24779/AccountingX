import { useTranslation } from 'react-i18next';
import { ThreadList } from '@/components/codex/thread/ThreadList';
import { SideBarProjectList } from './SideBarProjectList';

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
