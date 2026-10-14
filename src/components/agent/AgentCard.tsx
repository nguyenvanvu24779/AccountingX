import { useCodexStore } from '@/components/codex/stores';
import { codexService } from '@/services/codexService';
import { useAgentCenterStore } from '@/stores';
import type { AgentCenterCard } from '@/stores/useAgentCenterStore';
import { AgentCardHeader } from './AgentCardHeader';
import { CodexAgentCard } from './CodexAgentCard';

type AgentStatus = 'running' | 'pending' | 'idle';

export interface AgentCardProps {
  card: AgentCenterCard;
  onRemove: () => void;
  isSelected: boolean;
  // When true, only the header is rendered (used by the list view).
  hideBody?: boolean;
}

export function AgentCard({ card, onRemove, isSelected, hideBody = false }: AgentCardProps) {
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { threadStatusMap } = useCodexStore();
  const codexStatus = threadStatusMap[card.id];
  const running = codexStatus?.type === 'active' && codexStatus.activeFlags.length === 0;
  const pending = codexStatus?.type === 'active' && codexStatus.activeFlags.length > 0;
  const status: AgentStatus = running ? 'running' : pending ? 'pending' : 'idle';

  const header = (
    <AgentCardHeader
      card={card}
      onClose={onRemove}
      onSelect={() => {
        setCurrentAgentCardId(card.id);
        // Switch the underlying thread so single view renders this card's content.
        codexService.setCurrentThread(card.id);
      }}
      status={status}
    />
  );

  // List view: render header only, no body/footer.
  if (hideBody) {
    const attentionBorder = isSelected ? 'ring-2 ring-primary/60 border-primary/30' : 'border';
    return (
      <div className={`rounded-lg bg-background overflow-hidden ${attentionBorder}`}>{header}</div>
    );
  }

  return <CodexAgentCard card={card} onRemove={onRemove} header={header} isSelected={isSelected} />;
}
