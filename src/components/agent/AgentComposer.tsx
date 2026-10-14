import { Composer as CodexComposer } from '@/components/codex/composer';
import { useAgentCenterStore } from '@/stores';
import { WorkspaceSwitcher } from '../common';

export function AgentComposer() {
  const { currentAgentCardId } = useAgentCenterStore();

  return (
    <div className="flex flex-col">
      {/* Input area */}
      <div className={`shrink-0 ${currentAgentCardId && 'pb-2'}`}>
        <CodexComposer />
      </div>
      {!currentAgentCardId && <WorkspaceSwitcher />}
    </div>
  );
}
